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
} from "./domain.ts"
import { publishUrl } from "./endpoint.ts"

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const parseJson = (text: string) =>
  Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: (cause) => new InvalidResponseError({ reason: reasonOf(cause) }),
  })

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
    const body = yield* parseJson(responseText)

    if (response.status !== 201) {
      const message =
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : `server returned HTTP ${response.status}`
      return yield* new ApiError({ status: response.status, message })
    }

    return yield* Schema.decodeUnknown(PublishResponseSchema)(body).pipe(
      Effect.mapError(
        (cause) => new InvalidResponseError({ reason: String(cause) }),
      ),
    )
  })

