import { FileSystem } from "@effect/platform"
import { Console, Effect, Option } from "effect"

import {
  defaultConfigPath,
  loadProfile,
  removeProfile,
  resetConfiguredEndpoint,
  resolveEndpoint,
  resolveEndpointSelection,
  saveProfile,
  setConfiguredEndpoint,
} from "./config.ts"
import {
  HtmlFileError,
  InvalidInkIdError,
  MAX_HTML_BYTES,
  MissingProfileError,
} from "./domain.ts"
import { DEFAULT_ENDPOINT } from "./endpoint.ts"
import { deleteInk, publishHtml, updateInk } from "./publisher.ts"

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

export interface PublishOptions {
  readonly file: string
  readonly endpoint: Option.Option<string>
  readonly json: boolean
}

const readHtmlFile = (file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const bytes = yield* fs.readFile(file).pipe(
      Effect.mapError(
        (cause) => new HtmlFileError({ path: file, reason: reasonOf(cause) }),
      ),
    )
    if (bytes.byteLength > MAX_HTML_BYTES) {
      return yield* new HtmlFileError({
        path: file,
        reason: "HTML exceeds the server's 10 MiB limit",
      })
    }
    const html = yield* Effect.try({
      try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      catch: () => new HtmlFileError({ path: file, reason: "file is not valid UTF-8" }),
    })
    if (html.trim().length === 0) {
      return yield* new HtmlFileError({ path: file, reason: "HTML must not be empty" })
    }
    return html
  })

const validateInkId = (id: string) =>
  Effect.try({
    try: () => {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        )
      ) {
        throw new Error("invalid UUID")
      }
      return id
    },
    catch: () => new InvalidInkIdError({ id }),
  })

const requireProfile = (configPath: string, endpoint: string) =>
  loadProfile(configPath, endpoint).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => new MissingProfileError({ endpoint }),
        onSome: Effect.succeed,
      }),
    ),
  )

export const publishFile = ({ file, endpoint: endpointOverride, json }: PublishOptions) =>
  Effect.gen(function* () {
    const configPath = yield* defaultConfigPath
    const endpoint = yield* resolveEndpoint(configPath, endpointOverride)
    const html = yield* readHtmlFile(file)

    const profile = yield* loadProfile(configPath, endpoint)
    const result = yield* publishHtml(
      endpoint,
      html,
      Option.map(profile, ({ authToken }) => authToken),
    )

    // The server invalidates the previous token as part of a successful publish.
    // Persist its replacement before reporting success to the user.
    yield* saveProfile(configPath, endpoint, {
      name: result.name,
      authToken: result.auth_token,
    })

    if (json) {
      yield* Console.log(
        JSON.stringify({
          id: result.id,
          name: result.name,
          slug: result.slug,
          url: result.url,
          local_url: result.local_url,
        }),
      )
    } else {
      yield* Console.log(`Published ${file}`)
      yield* Console.log(result.url)
      yield* Console.log(`Publisher: ${result.name}`)
    }
  })

export interface UpdateOptions extends PublishOptions {
  readonly id: string
}

export const updateFile = ({
  id: idInput,
  file,
  endpoint: endpointOverride,
  json,
}: UpdateOptions) =>
  Effect.gen(function* () {
    const id = yield* validateInkId(idInput)
    const configPath = yield* defaultConfigPath
    const endpoint = yield* resolveEndpoint(configPath, endpointOverride)
    const profile = yield* requireProfile(configPath, endpoint)
    const html = yield* readHtmlFile(file)
    const result = yield* updateInk(endpoint, id, html, profile.authToken)

    if (json) {
      yield* Console.log(
        JSON.stringify({
          id: result.id,
          name: result.name,
          slug: result.slug,
          url: result.url,
          local_url: result.local_url,
        }),
      )
    } else {
      yield* Console.log(`Updated ${id} from ${file}`)
      yield* Console.log(result.url)
      yield* Console.log(`Publisher: ${result.name}`)
    }
  })

export interface DeleteOptions {
  readonly id: string
  readonly endpoint: Option.Option<string>
  readonly json: boolean
}

export const deleteDocument = ({
  id: idInput,
  endpoint: endpointOverride,
  json,
}: DeleteOptions) =>
  Effect.gen(function* () {
    const id = yield* validateInkId(idInput)
    const configPath = yield* defaultConfigPath
    const endpoint = yield* resolveEndpoint(configPath, endpointOverride)
    const profile = yield* requireProfile(configPath, endpoint)
    yield* deleteInk(endpoint, id, profile.authToken)

    if (json) yield* Console.log(JSON.stringify({ id, deleted: true }))
    else yield* Console.log(`Deleted ${id}`)
  })

export const showIdentity = (endpointOverride: Option.Option<string>, json: boolean) =>
  Effect.gen(function* () {
    const configPath = yield* defaultConfigPath
    const endpoint = yield* resolveEndpoint(configPath, endpointOverride)
    const profile = yield* loadProfile(configPath, endpoint)
    if (Option.isNone(profile)) {
      if (json) yield* Console.log(JSON.stringify({ endpoint, authenticated: false }))
      else yield* Console.log(`No saved publisher for ${endpoint}`)
      return
    }
    if (json) {
      yield* Console.log(
        JSON.stringify({ endpoint, authenticated: true, name: profile.value.name }),
      )
    } else {
      yield* Console.log(profile.value.name)
      yield* Console.log(endpoint)
    }
  })

export const logout = (endpointOverride: Option.Option<string>) =>
  Effect.gen(function* () {
    const configPath = yield* defaultConfigPath
    const endpoint = yield* resolveEndpoint(configPath, endpointOverride)
    const removed = yield* removeProfile(configPath, endpoint)
    yield* Console.log(
      removed
        ? `Removed the saved publisher for ${endpoint}`
        : `No saved publisher for ${endpoint}`,
    )
  })

export const showConfig = (json: boolean) =>
  Effect.gen(function* () {
    const configPath = yield* defaultConfigPath
    const selection = yield* resolveEndpointSelection(configPath, Option.none())
    if (json) {
      yield* Console.log(
        JSON.stringify({
          path: configPath,
          endpoint: selection.endpoint,
          endpoint_source: selection.source,
        }),
      )
    } else {
      yield* Console.log(`Config: ${configPath}`)
      yield* Console.log(`Endpoint: ${selection.endpoint}`)
      const source =
        selection.source === "environment"
          ? "FABS_INK_API_URL"
          : selection.source === "config"
            ? "saved config"
            : `production default (${DEFAULT_ENDPOINT})`
      yield* Console.log(`Source: ${source}`)
    }
  })

export const configureEndpoint = (endpointInput: string) =>
  Effect.gen(function* () {
    const configPath = yield* defaultConfigPath
    const endpoint = yield* setConfiguredEndpoint(configPath, endpointInput)
    yield* Console.log(`Endpoint saved: ${endpoint}`)
    yield* Console.log(`Config: ${configPath}`)
  })

export const resetEndpoint = Effect.gen(function* () {
  const configPath = yield* defaultConfigPath
  yield* resetConfiguredEndpoint(configPath)
  yield* Console.log(`Endpoint reset to ${DEFAULT_ENDPOINT}`)
  yield* Console.log(`Config: ${configPath}`)
})
