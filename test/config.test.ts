import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { BunContext } from "@effect/platform-bun"
import { Effect, Either, Option } from "effect"

import {
  loadProfile,
  readConfig,
  removeProfile,
  resetConfiguredEndpoint,
  resolveEndpoint,
  saveProfile,
  setConfiguredEndpoint,
} from "../src/config.ts"

const temporaryDirectories: Array<string> = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

const run = <A, E>(effect: Effect.Effect<A, E, BunContext.BunContext>) =>
  Effect.runPromise(effect.pipe(Effect.provide(BunContext.layer)))

describe("config", () => {
  test("stores an endpoint and rotating profiles in one secure file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fabs-ink-cli-"))
    temporaryDirectories.push(directory)
    const configPath = join(directory, "nested", "config.json")
    const endpoint = "http://127.0.0.1:3000"

    expect(await run(resolveEndpoint(configPath, Option.none()))).toBe(
      "https://fabs.ink",
    )
    expect(await run(setConfiguredEndpoint(configPath, `${endpoint}/`))).toBe(endpoint)

    await run(
      saveProfile(configPath, endpoint, {
        name: "calm-writer-0042",
        authToken: "first-token",
      }),
    )
    await run(
      saveProfile(configPath, endpoint, {
        name: "calm-writer-0042",
        authToken: "rotated-token",
      }),
    )

    const profile = await run(loadProfile(configPath, endpoint))
    expect(Option.getOrThrow(profile)).toEqual({
      name: "calm-writer-0042",
      authToken: "rotated-token",
    })
    expect((await stat(configPath)).mode & 0o777).toBe(0o600)
    expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({
      version: 1,
      endpoint,
      profiles: {
        [endpoint]: {
          name: "calm-writer-0042",
          authToken: "rotated-token",
        },
      },
    })

    expect(await run(removeProfile(configPath, endpoint))).toBeTrue()
    await run(resetConfiguredEndpoint(configPath))
    expect(await run(readConfig(configPath))).toEqual({ version: 1, profiles: {} })
  })

  test("a command-line endpoint overrides saved configuration", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fabs-ink-cli-"))
    temporaryDirectories.push(directory)
    const configPath = join(directory, "config.json")
    await run(setConfiguredEndpoint(configPath, "http://127.0.0.1:3000"))

    expect(
      await run(
        resolveEndpoint(
          configPath,
          Option.some("http://localhost:4000/"),
          "http://environment.example:5000",
        ),
      ),
    ).toBe("http://localhost:4000")
  })

  test("an environment endpoint overrides saved configuration", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fabs-ink-cli-"))
    temporaryDirectories.push(directory)
    const configPath = join(directory, "config.json")
    await run(setConfiguredEndpoint(configPath, "http://127.0.0.1:3000"))

    expect(
      await run(
        resolveEndpoint(
          configPath,
          Option.none(),
          "http://localhost:4000/",
        ),
      ),
    ).toBe("http://localhost:4000")
  })

  test("refuses to overwrite a malformed config file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fabs-ink-cli-"))
    temporaryDirectories.push(directory)
    const configPath = join(directory, "config.json")
    await Bun.write(configPath, "not-json")

    const result = await Effect.runPromise(
      Effect.either(
        setConfiguredEndpoint(configPath, "https://fabs.ink").pipe(
          Effect.provide(BunContext.layer),
        ),
      ),
    )

    expect(Either.isLeft(result)).toBeTrue()
    expect(await readFile(configPath, "utf8")).toBe("not-json")
  })
})
