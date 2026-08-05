import {
  HttpClient,
  HttpClientRequest,
} from "@effect/platform"
import { Effect, Option, Schema } from "effect"

import {
  ApiError,
  InvalidResponseError,
  NetworkError,
  PublishResponseSchema,
  type PublishResponse,
  UpdateResponseSchema,
  type UpdateResponse,
} from "./domain.ts"
import { inkUrl, publishUrl } from "./endpoint.ts"

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const parseJson = (text: string) =>
  Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: (cause) => new InvalidResponseError({ reason: reasonOf(cause) }),
  })

const apiError = (status: number, text: string): ApiError => {
  let message = `server returned HTTP ${status}`
  try {
    const body = JSON.parse(text) as unknown
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      message = body.error
    }
  } catch {
    // Non-JSON error responses still receive a useful status-based message.
  }
  return new ApiError({ status, message })
}

export const publishHtml = (
  endpoint: string,
  html: string,
  token: Option.Option<string>,
): Effect.Effect<
  PublishResponse,
  NetworkError | ApiError | InvalidResponseError,
  HttpClient.HttpClient
> =>
  Effect.gen(function* () {
    const url = publishUrl(endpoint)
    let request = HttpClientRequest.post(url).pipe(
      HttpClientRequest.acceptJson,
      HttpClientRequest.bodyText(html, "text/html; charset=utf-8"),
    )
    if (Option.isSome(token)) {
      request = request.pipe(HttpClientRequest.bearerToken(token.value))
    }

    const response = yield* HttpClient.execute(request).pipe(
      Effect.mapError(
        (cause) => new NetworkError({ endpoint, reason: reasonOf(cause) }),
      ),
    )
    const responseText = yield* response.text.pipe(
      Effect.mapError(
        (cause) => new NetworkError({ endpoint, reason: reasonOf(cause) }),
      ),
    )
    if (response.status !== 201) {
      return yield* apiError(response.status, responseText)
    }

    const body = yield* parseJson(responseText)

    return yield* Schema.decodeUnknown(PublishResponseSchema)(body).pipe(
      Effect.mapError(
        (cause) => new InvalidResponseError({ reason: String(cause) }),
      ),
    )
  })

export const updateInk = (
  endpoint: string,
  id: string,
  html: string,
  token: string,
): Effect.Effect<
  UpdateResponse,
  NetworkError | ApiError | InvalidResponseError,
  HttpClient.HttpClient
> =>
  Effect.gen(function* () {
    const request = HttpClientRequest.put(inkUrl(endpoint, id)).pipe(
      HttpClientRequest.acceptJson,
      HttpClientRequest.bodyText(html, "text/html; charset=utf-8"),
      HttpClientRequest.bearerToken(token),
    )
    const response = yield* HttpClient.execute(request).pipe(
      Effect.mapError(
        (cause) => new NetworkError({ endpoint, reason: reasonOf(cause) }),
      ),
    )
    const responseText = yield* response.text.pipe(
      Effect.mapError(
        (cause) => new NetworkError({ endpoint, reason: reasonOf(cause) }),
      ),
    )
    if (response.status !== 200) {
      return yield* apiError(response.status, responseText)
    }
    const body = yield* parseJson(responseText)
    return yield* Schema.decodeUnknown(UpdateResponseSchema)(body).pipe(
      Effect.mapError(
        (cause) => new InvalidResponseError({ reason: String(cause) }),
      ),
    )
  })

export const deleteInk = (
  endpoint: string,
  id: string,
  token: string,
): Effect.Effect<
  void,
  NetworkError | ApiError,
  HttpClient.HttpClient
> =>
  Effect.gen(function* () {
    const request = HttpClientRequest.del(inkUrl(endpoint, id)).pipe(
      HttpClientRequest.acceptJson,
      HttpClientRequest.bearerToken(token),
    )
    const response = yield* HttpClient.execute(request).pipe(
      Effect.mapError(
        (cause) => new NetworkError({ endpoint, reason: reasonOf(cause) }),
      ),
    )
    const responseText = yield* response.text.pipe(
      Effect.mapError(
        (cause) => new NetworkError({ endpoint, reason: reasonOf(cause) }),
      ),
    )
    if (response.status !== 204) {
      return yield* apiError(response.status, responseText)
    }
  })
