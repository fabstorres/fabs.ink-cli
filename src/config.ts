import { homedir } from "node:os"

import { FileSystem, Path } from "@effect/platform"
import { Effect, Option, Schema } from "effect"

import {
  ConfigError,
  ConfigFileSchema,
  type ConfigFile,
  type Profile,
} from "./domain.ts"
import { DEFAULT_ENDPOINT, normalizeEndpoint } from "./endpoint.ts"

const emptyConfig = (): ConfigFile => ({ version: 1, profiles: {} })

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

export const defaultConfigPath = Effect.gen(function* () {
  const path = yield* Path.Path
  return path.join(homedir(), ".fabs.ink", "config.json")
})

export const readConfig = (configPath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const exists = yield* fs.exists(configPath).pipe(
      Effect.mapError(
        (cause) => new ConfigError({ path: configPath, reason: reasonOf(cause) }),
      ),
    )
    if (!exists) return emptyConfig()

    const text = yield* fs.readFileString(configPath).pipe(
      Effect.mapError(
        (cause) => new ConfigError({ path: configPath, reason: reasonOf(cause) }),
      ),
    )
    const json = yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: (cause) =>
        new ConfigError({
          path: configPath,
          reason: `invalid JSON: ${reasonOf(cause)}`,
        }),
    })
    return yield* Schema.decodeUnknown(ConfigFileSchema)(json).pipe(
      Effect.mapError(
        (cause) =>
          new ConfigError({
            path: configPath,
            reason: `invalid config format: ${String(cause)}`,
          }),
      ),
    )
  })

export const writeConfig = (configPath: string, config: ConfigFile) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = path.dirname(configPath)
    const temporaryPath = `${configPath}.${process.pid}.${Date.now()}.tmp`
    const contents = `${JSON.stringify(config, null, 2)}\n`

    yield* fs.makeDirectory(directory, { recursive: true, mode: 0o700 }).pipe(
      Effect.mapError(
        (cause) => new ConfigError({ path: configPath, reason: reasonOf(cause) }),
      ),
    )
    yield* fs.writeFileString(temporaryPath, contents, { mode: 0o600 }).pipe(
      Effect.andThen(fs.chmod(temporaryPath, 0o600)),
      Effect.andThen(fs.rename(temporaryPath, configPath)),
      Effect.andThen(fs.chmod(configPath, 0o600)),
      Effect.mapError(
        (cause) => new ConfigError({ path: configPath, reason: reasonOf(cause) }),
      ),
    )
  })

export type EndpointSource = "argument" | "environment" | "config" | "default"

export const resolveEndpointSelection = (
  configPath: string,
  override: Option.Option<string>,
  environmentEndpoint: string | undefined = process.env.FABS_INK_API_URL,
) =>
  Effect.gen(function* () {
    if (Option.isSome(override)) {
      return {
        endpoint: yield* normalizeEndpoint(override.value),
        source: "argument" as const,
      }
    }
    if (environmentEndpoint) {
      return {
        endpoint: yield* normalizeEndpoint(environmentEndpoint),
        source: "environment" as const,
      }
    }
    const config = yield* readConfig(configPath)
    if (config.endpoint) {
      return {
        endpoint: yield* normalizeEndpoint(config.endpoint),
        source: "config" as const,
      }
    }
    return { endpoint: DEFAULT_ENDPOINT, source: "default" as const }
  })

export const resolveEndpoint = (
  configPath: string,
  override: Option.Option<string>,
  environmentEndpoint: string | undefined = process.env.FABS_INK_API_URL,
) =>
  resolveEndpointSelection(configPath, override, environmentEndpoint).pipe(
    Effect.map(({ endpoint }) => endpoint),
  )

export const setConfiguredEndpoint = (configPath: string, endpointInput: string) =>
  Effect.gen(function* () {
    const endpoint = yield* normalizeEndpoint(endpointInput)
    const config = yield* readConfig(configPath)
    yield* writeConfig(configPath, { ...config, endpoint })
    return endpoint
  })

export const resetConfiguredEndpoint = (configPath: string) =>
  Effect.gen(function* () {
    const config = yield* readConfig(configPath)
    const { endpoint: _, ...withoutEndpoint } = config
    yield* writeConfig(configPath, withoutEndpoint)
  })

export const loadProfile = (configPath: string, endpoint: string) =>
  readConfig(configPath).pipe(
    Effect.map((config) => Option.fromNullable(config.profiles[endpoint])),
  )

export const saveProfile = (
  configPath: string,
  endpoint: string,
  profile: Profile,
) =>
  Effect.gen(function* () {
    const config = yield* readConfig(configPath)
    yield* writeConfig(configPath, {
      ...config,
      profiles: { ...config.profiles, [endpoint]: profile },
    })
  })

export const removeProfile = (configPath: string, endpoint: string) =>
  Effect.gen(function* () {
    const config = yield* readConfig(configPath)
    if (!(endpoint in config.profiles)) return false
    const profiles = { ...config.profiles }
    delete profiles[endpoint]
    yield* writeConfig(configPath, { ...config, profiles })
    return true
  })
