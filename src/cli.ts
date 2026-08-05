#!/usr/bin/env bun

import { Args, Command, Options } from "@effect/cli"
import { FetchHttpClient } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Layer } from "effect"

import type { AppError } from "./domain.ts"
import {
  configureEndpoint,
  deleteDocument,
  logout,
  publishFile,
  resetEndpoint,
  showConfig,
  showIdentity,
  updateFile,
} from "./workflows.ts"

const endpoint = Options.text("endpoint").pipe(
  Options.optional,
  Options.withDescription(
    "Override FABS_INK_API_URL and the configured server URL",
  ),
)
const json = Options.boolean("json").pipe(
  Options.withDescription("Print machine-readable JSON"),
)

const publish = Command.make(
  "publish",
  {
    file: Args.file({ name: "file", exists: "yes" }).pipe(
      Args.withDescription("HTML file to publish"),
    ),
    endpoint,
    json,
  },
  publishFile,
).pipe(Command.withDescription("Publish an HTML file"))

const documentId = Args.text({ name: "id" }).pipe(
  Args.withDescription("Document ID returned by publish"),
)

const update = Command.make(
  "update",
  {
    id: documentId,
    file: Args.file({ name: "file", exists: "yes" }).pipe(
      Args.withDescription("Replacement HTML file"),
    ),
    endpoint,
    json,
  },
  updateFile,
).pipe(Command.withDescription("Replace a published HTML document"))

const deleteCommand = Command.make(
  "delete",
  { id: documentId, endpoint, json },
  deleteDocument,
).pipe(Command.withDescription("Delete a published HTML document"))

const whoami = Command.make(
  "whoami",
  { endpoint, json },
  ({ endpoint, json }) => showIdentity(endpoint, json),
).pipe(Command.withDescription("Show the saved publisher identity"))

const logoutCommand = Command.make(
  "logout",
  { endpoint },
  ({ endpoint }) => logout(endpoint),
).pipe(Command.withDescription("Forget the saved publisher identity"))

const setEndpoint = Command.make(
  "set-endpoint",
  {
    endpoint: Args.text({ name: "url" }).pipe(
      Args.withDescription("Server URL to save as the default"),
    ),
  },
  ({ endpoint }) => configureEndpoint(endpoint),
).pipe(Command.withDescription("Save the default server endpoint"))

const resetEndpointCommand = Command.make(
  "reset-endpoint",
  {},
  () => resetEndpoint,
).pipe(Command.withDescription("Restore the production endpoint"))

const configCommand = Command.make(
  "config",
  { json },
  ({ json }) => showConfig(json),
).pipe(
  Command.withDescription("Show or change CLI configuration"),
  Command.withSubcommands([setEndpoint, resetEndpointCommand]),
)

const root = Command.make("fabs.ink").pipe(
  Command.withDescription("Publish safe HTML pages to fabs.ink"),
  Command.withSubcommands([
    publish,
    update,
    deleteCommand,
    whoami,
    logoutCommand,
    configCommand,
  ]),
)

const cli = Command.run(root, {
  name: "fabs.ink CLI",
  version: "0.1.0",
})

const renderError = (error: AppError): Effect.Effect<void> => {
  switch (error._tag) {
    case "InvalidEndpointError":
      return Console.error(`Invalid endpoint ${error.endpoint}: ${error.reason}`)
    case "HtmlFileError":
      return Console.error(`Could not read ${error.path}: ${error.reason}`)
    case "InvalidInkIdError":
      return Console.error(`Invalid document ID ${error.id}: expected a UUID`)
    case "MissingProfileError":
      return Console.error(
        `No saved publisher for ${error.endpoint}. Publish a document first to create an identity.`,
      )
    case "ConfigError":
      return Console.error(`Could not update config at ${error.path}: ${error.reason}`)
    case "NetworkError":
      return Console.error(`Could not reach ${error.endpoint}: ${error.reason}`)
    case "ApiError":
      return Console.error(
        error.status === 401
          ? "The saved publisher token is no longer valid. Run `fabs.ink logout`, then publish again to create a new identity."
          : `Request failed (${error.status}): ${error.message}`,
      )
    case "InvalidResponseError":
      return Console.error(`The server returned an invalid response: ${error.reason}`)
  }
}

const appErrorTags = new Set<AppError["_tag"]>([
  "InvalidEndpointError",
  "HtmlFileError",
  "InvalidInkIdError",
  "MissingProfileError",
  "ConfigError",
  "NetworkError",
  "ApiError",
  "InvalidResponseError",
])

const isAppError = (error: unknown): error is AppError =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  appErrorTags.has(error._tag as AppError["_tag"])

const AppLayer = Layer.mergeAll(BunContext.layer, FetchHttpClient.layer)

cli(process.argv).pipe(
  Effect.catchAll((error) =>
    isAppError(error)
      ? renderError(error).pipe(
          Effect.andThen(
            Effect.sync(() => {
              process.exitCode = 1
            }),
          ),
        )
      : Effect.fail(error),
  ),
  Effect.provide(AppLayer),
  BunRuntime.runMain,
)
