import { describe, expect, test } from "bun:test"
import { Effect, Either } from "effect"

import { normalizeEndpoint, publishUrl } from "../src/endpoint.ts"

describe("normalizeEndpoint", () => {
  test("normalizes a server base URL", async () => {
    const endpoint = await Effect.runPromise(
      normalizeEndpoint("http://127.0.0.1:3000/"),
    )

    expect(endpoint).toBe("http://127.0.0.1:3000")
    expect(publishUrl(endpoint)).toBe("http://127.0.0.1:3000/publish")
  })

  test("rejects unsafe or ambiguous URLs", async () => {
    for (const input of [
      "ftp://example.com",
      "https://user:secret@example.com",
      "https://example.com?environment=test",
    ]) {
      const result = await Effect.runPromise(Effect.either(normalizeEndpoint(input)))
      expect(Either.isLeft(result)).toBeTrue()
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("InvalidEndpointError")
      }
    }
  })
})

