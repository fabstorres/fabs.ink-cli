import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform"
import { Effect, Option, Schema } from "effect"

import {
  ApiError,
  DeviceCodeResponseSchema,
  type DeviceCodeResponse,
  DeviceTokenResponseSchema,
  type DeviceTokenResponse,
  InvalidResponseError,
  NetworkError,
} from "./domain.ts"
import { deviceAuthStartUrl, deviceAuthTokenUrl } from "./endpoint.ts"

export type AuthMode = "signup" | "login"

export type DevicePollResult =
  | { readonly _tag: "Pending" }
  | { readonly _tag: "Expired" }
  | { readonly _tag: "Approved"; readonly credentials: DeviceTokenResponse }

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const parseJson = (text: string) =>
  Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: (cause) => new InvalidResponseError({ reason: reasonOf(cause) }),
  })

const parseJsonOptional = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

const errorCode = (body: unknown): string | undefined =>
  typeof body === "object" &&
  body !== null &&
  "error" in body &&
  typeof body.error === "string"
    ? body.error
    : undefined

const apiError = (status: number, body: unknown): ApiError => {
  const code = errorCode(body)
  const description =
    typeof body === "object" &&
    body !== null &&
    "error_description" in body &&
    typeof body.error_description === "string"
      ? body.error_description
      : undefined
  return new ApiError({
    status,
    message: description ? `${code ?? "request_failed"}: ${description}` : code ?? `server returned HTTP ${status}`,
  })
}

const responseText = (endpoint: string, response: HttpClientResponse.HttpClientResponse) =>
  response.text.pipe(
    Effect.mapError(
      (cause) => new NetworkError({ endpoint, reason: reasonOf(cause) }),
    ),
  )

export const startDeviceAuthorization = (
  endpoint: string,
  mode: AuthMode,
  guestToken: Option.Option<string>,
): Effect.Effect<
  DeviceCodeResponse,
  NetworkError | ApiError | InvalidResponseError,
  HttpClient.HttpClient
> =>
  Effect.gen(function* () {
    let request = HttpClientRequest.post(deviceAuthStartUrl(endpoint, mode)).pipe(
      HttpClientRequest.acceptJson,
    )
    if (mode === "signup" && Option.isSome(guestToken)) {
      request = request.pipe(HttpClientRequest.bearerToken(guestToken.value))
    }

    const response = yield* HttpClient.execute(request).pipe(
      Effect.mapError(
        (cause) => new NetworkError({ endpoint, reason: reasonOf(cause) }),
      ),
    )
    const text = yield* responseText(endpoint, response)
    if (response.status !== 200) {
      return yield* apiError(response.status, parseJsonOptional(text))
    }
    const body = yield* parseJson(text)

    return yield* Schema.decodeUnknown(DeviceCodeResponseSchema)(body).pipe(
      Effect.flatMap((start) =>
        Effect.try({
          try: () => {
            for (const value of [
              start.verification_uri,
              start.verification_uri_complete,
            ]) {
              const url = new URL(value)
              if (url.protocol !== "http:" && url.protocol !== "https:") {
                throw new Error("verification URLs must use http or https")
              }
            }
            return start
          },
          catch: (cause) =>
            new InvalidResponseError({ reason: reasonOf(cause) }),
        }),
      ),
      Effect.mapError(
        (cause) => new InvalidResponseError({ reason: String(cause) }),
      ),
    )
  })

export const pollDeviceAuthorization = (
  endpoint: string,
  deviceCode: string,
): Effect.Effect<
  DevicePollResult,
  NetworkError | ApiError | InvalidResponseError,
  HttpClient.HttpClient
> =>
  Effect.gen(function* () {
    const request = HttpClientRequest.post(deviceAuthTokenUrl(endpoint)).pipe(
      HttpClientRequest.acceptJson,
      HttpClientRequest.bodyUnsafeJson({ device_code: deviceCode }),
    )
    const response = yield* HttpClient.execute(request).pipe(
      Effect.mapError(
        (cause) => new NetworkError({ endpoint, reason: reasonOf(cause) }),
      ),
    )
    const text = yield* responseText(endpoint, response)
    const errorBody = response.status === 200 ? undefined : parseJsonOptional(text)

    if (response.status === 400) {
      const code = errorCode(errorBody)
      if (code === "authorization_pending") return { _tag: "Pending" }
      if (code === "expired_token") return { _tag: "Expired" }
    }
    if (response.status !== 200) return yield* apiError(response.status, errorBody)
    const body = yield* parseJson(text)

    const credentials = yield* Schema.decodeUnknown(DeviceTokenResponseSchema)(body).pipe(
      Effect.mapError(
        (cause) => new InvalidResponseError({ reason: String(cause) }),
      ),
    )
    return { _tag: "Approved", credentials }
  })
