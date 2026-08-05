import { Effect } from "effect"

import { InvalidEndpointError } from "./domain.ts"

export const DEFAULT_ENDPOINT = "https://fabs.ink"

export const normalizeEndpoint = (
  input: string,
): Effect.Effect<string, InvalidEndpointError> =>
  Effect.try({
    try: () => {
      const url = new URL(input)
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("URL must use http or https")
      }
      if (url.username || url.password) {
        throw new Error("URL must not include credentials")
      }
      if (url.search || url.hash) {
        throw new Error("URL must not include a query string or fragment")
      }
      url.pathname = url.pathname.replace(/\/+$/, "")
      return url.toString().replace(/\/$/, "")
    },
    catch: (cause) =>
      new InvalidEndpointError({
        endpoint: input,
        reason: cause instanceof Error ? cause.message : String(cause),
      }),
  })

export const publishUrl = (endpoint: string): string => `${endpoint}/publish`

export const inkUrl = (endpoint: string, id: string): string =>
  `${endpoint}/inks/${encodeURIComponent(id)}`
