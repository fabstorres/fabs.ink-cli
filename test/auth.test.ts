import { afterEach, describe, expect, test } from "bun:test"

import { FetchHttpClient, HttpClient } from "@effect/platform"
import { Effect, Either, Option } from "effect"

import { pollDeviceAuthorization, startDeviceAuthorization } from "../src/auth.ts"

const servers: Array<ReturnType<typeof Bun.serve>> = []

afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true)
})

const startResponse = {
  device_code: "private-device-secret",
  user_code: "ABCD-EFGH",
  verification_uri: "https://fabs.ink/auth",
  verification_uri_complete: "https://fabs.ink/auth?code=ABCD-EFGH",
  expires_in: 600,
  interval: 5,
}

const run = <A, E>(effect: Effect.Effect<A, E, HttpClient.HttpClient>) =>
  Effect.runPromise(effect.pipe(Effect.provide(FetchHttpClient.layer)))

describe("device authorization", () => {
  test("sends a guest token for signup but never for login", async () => {
    const requests: Array<{ path: string; authorization: string | null }> = []
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        requests.push({
          path: new URL(request.url).pathname,
          authorization: request.headers.get("authorization"),
        })
        return Response.json(startResponse)
      },
    })
    servers.push(server)
    const endpoint = `http://127.0.0.1:${server.port}`

    await run(startDeviceAuthorization(endpoint, "signup", Option.some("guest-token")))
    await run(startDeviceAuthorization(endpoint, "login", Option.some("must-not-send")))

    expect(requests).toEqual([
      {
        path: "/auth/device/signup",
        authorization: "Bearer guest-token",
      },
      { path: "/auth/device/login", authorization: null },
    ])
  })

  test("treats pending and expired responses as polling states", async () => {
    let poll = 0
    const requestBodies: Array<unknown> = []
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        requestBodies.push(await request.json())
        poll += 1
        return Response.json(
          poll === 1
            ? { error: "authorization_pending", error_description: "not finished" }
            : { error: "expired_token", error_description: "expired" },
          { status: 400 },
        )
      },
    })
    servers.push(server)
    const endpoint = `http://127.0.0.1:${server.port}`

    expect(await run(pollDeviceAuthorization(endpoint, "private-code"))).toEqual({
      _tag: "Pending",
    })
    expect(await run(pollDeviceAuthorization(endpoint, "private-code"))).toEqual({
      _tag: "Expired",
    })
    expect(requestBodies).toEqual([
      { device_code: "private-code" },
      { device_code: "private-code" },
    ])
  })

  test("decodes an approved session and useful start errors", async () => {
    const approvedServer = Bun.serve({
      port: 0,
      fetch: () =>
        Response.json({
          access_token: "new-session-token",
          token_type: "Bearer",
          handle: "maker",
        }),
    })
    servers.push(approvedServer)

    const approved = await run(
      pollDeviceAuthorization(
        `http://127.0.0.1:${approvedServer.port}`,
        "private-code",
      ),
    )
    expect(approved).toEqual({
      _tag: "Approved",
      credentials: {
        access_token: "new-session-token",
        token_type: "Bearer",
        handle: "maker",
      },
    })

    const unavailableServer = Bun.serve({
      port: 0,
      fetch: () =>
        Response.json(
          {
            error: "oauth_unavailable",
            error_description: "Google OAuth is not configured on this server",
          },
          { status: 503 },
        ),
    })
    servers.push(unavailableServer)
    const result = await Effect.runPromise(
      Effect.either(
        startDeviceAuthorization(
          `http://127.0.0.1:${unavailableServer.port}`,
          "login",
          Option.none(),
        ).pipe(Effect.provide(FetchHttpClient.layer)),
      ),
    )
    expect(Either.isLeft(result)).toBeTrue()
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "ApiError",
        status: 503,
        message:
          "oauth_unavailable: Google OAuth is not configured on this server",
      })
    }
  })
})
