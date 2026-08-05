import { afterEach, describe, expect, test } from "bun:test"

import { FetchHttpClient } from "@effect/platform"
import { Effect, Either, Option } from "effect"

import { deleteInk, publishHtml, updateInk } from "../src/publisher.ts"

const servers: Array<ReturnType<typeof Bun.serve>> = []

afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true)
})

const response = (authToken: string) =>
  Response.json(
    {
      id: "019c2f48-14c4-7c02-95e7-5f2d4dc07c58",
      name: "cool-developer-0347",
      slug: "crystal-report",
      url: "https://cool-developer-0347.fabs.ink/crystal-report",
      local_url: "/view/cool-developer-0347/crystal-report",
      auth_token: authToken,
    },
    { status: 201 },
  )

const updateResponse = () =>
  Response.json({
    id: "019c2f48-14c4-7c02-95e7-5f2d4dc07c58",
    name: "cool-developer-0347",
    slug: "crystal-report",
    url: "https://cool-developer-0347.fabs.ink/crystal-report",
    local_url: "/view/cool-developer-0347/crystal-report",
  })

describe("publishHtml", () => {
  test("sends HTML and the current bearer token", async () => {
    const requests: Array<{ body: string; authorization: string | null }> = []
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        requests.push({
          body: await request.text(),
          authorization: request.headers.get("authorization"),
        })
        return response("next-token")
      },
    })
    servers.push(server)
    const endpoint = `http://127.0.0.1:${server.port}`

    const result = await Effect.runPromise(
      publishHtml(endpoint, "<h1>Hello</h1>", Option.some("current-token")).pipe(
        Effect.provide(FetchHttpClient.layer),
      ),
    )

    expect(result.auth_token).toBe("next-token")
    expect(requests).toEqual([
      { body: "<h1>Hello</h1>", authorization: "Bearer current-token" },
    ])
  })

  test("decodes server errors", async () => {
    const server = Bun.serve({
      port: 0,
      fetch: () => Response.json({ error: "invalid auth token" }, { status: 401 }),
    })
    servers.push(server)

    const result = await Effect.runPromise(
      Effect.either(
        publishHtml(
          `http://127.0.0.1:${server.port}`,
          "<p>Hello</p>",
          Option.some("expired-token"),
        ).pipe(Effect.provide(FetchHttpClient.layer)),
      ),
    )

    expect(Either.isLeft(result)).toBeTrue()
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "ApiError",
        status: 401,
        message: "invalid auth token",
      })
    }
  })

  test("preserves HTTP errors when the response is not JSON", async () => {
    const server = Bun.serve({
      port: 0,
      fetch: () => new Response("route rejected the request", { status: 400 }),
    })
    servers.push(server)

    const result = await Effect.runPromise(
      Effect.either(
        publishHtml(
          `http://127.0.0.1:${server.port}`,
          "<p>Hello</p>",
          Option.none(),
        ).pipe(Effect.provide(FetchHttpClient.layer)),
      ),
    )

    expect(Either.isLeft(result)).toBeTrue()
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "ApiError",
        status: 400,
        message: "server returned HTTP 400",
      })
    }
  })
})

describe("updateInk", () => {
  test("puts replacement HTML to the authenticated document route", async () => {
    const requests: Array<{
      method: string
      path: string
      body: string
      authorization: string | null
    }> = []
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const url = new URL(request.url)
        requests.push({
          method: request.method,
          path: url.pathname,
          body: await request.text(),
          authorization: request.headers.get("authorization"),
        })
        return updateResponse()
      },
    })
    servers.push(server)
    const endpoint = `http://127.0.0.1:${server.port}`
    const id = "019c2f48-14c4-7c02-95e7-5f2d4dc07c58"

    const result = await Effect.runPromise(
      updateInk(endpoint, id, "<h1>Updated</h1>", "current-token").pipe(
        Effect.provide(FetchHttpClient.layer),
      ),
    )

    expect(result.id).toBe(id)
    expect(requests).toEqual([
      {
        method: "PUT",
        path: `/inks/${id}`,
        body: "<h1>Updated</h1>",
        authorization: "Bearer current-token",
      },
    ])
  })
})

describe("deleteInk", () => {
  test("deletes the authenticated document and accepts an empty 204 response", async () => {
    const requests: Array<{
      method: string
      path: string
      authorization: string | null
    }> = []
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url)
        requests.push({
          method: request.method,
          path: url.pathname,
          authorization: request.headers.get("authorization"),
        })
        return new Response(null, { status: 204 })
      },
    })
    servers.push(server)
    const endpoint = `http://127.0.0.1:${server.port}`
    const id = "019c2f48-14c4-7c02-95e7-5f2d4dc07c58"

    const result = await Effect.runPromise(
      deleteInk(endpoint, id, "current-token").pipe(
        Effect.provide(FetchHttpClient.layer),
      ),
    )

    expect(result).toBeUndefined()
    expect(requests).toEqual([
      {
        method: "DELETE",
        path: `/inks/${id}`,
        authorization: "Bearer current-token",
      },
    ])
  })
})
