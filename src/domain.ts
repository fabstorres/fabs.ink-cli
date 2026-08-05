import { Data, Schema } from "effect"

export const MAX_HTML_BYTES = 10 * 1024 * 1024

export const PublishResponseSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  url: Schema.String,
  local_url: Schema.String,
  auth_token: Schema.String,
})

export type PublishResponse = typeof PublishResponseSchema.Type

export const UpdateResponseSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  url: Schema.String,
  local_url: Schema.String,
})

export type UpdateResponse = typeof UpdateResponseSchema.Type

export const ProfileSchema = Schema.Struct({
  name: Schema.String,
  authToken: Schema.String,
})

export type Profile = typeof ProfileSchema.Type

export const ConfigFileSchema = Schema.Struct({
  version: Schema.Literal(1),
  endpoint: Schema.optional(Schema.String),
  profiles: Schema.Record({ key: Schema.String, value: ProfileSchema }),
})

export type ConfigFile = typeof ConfigFileSchema.Type

export class InvalidEndpointError extends Data.TaggedError("InvalidEndpointError")<{
  readonly endpoint: string
  readonly reason: string
}> {}

export class HtmlFileError extends Data.TaggedError("HtmlFileError")<{
  readonly path: string
  readonly reason: string
}> {}

export class InvalidInkIdError extends Data.TaggedError("InvalidInkIdError")<{
  readonly id: string
}> {}

export class MissingProfileError extends Data.TaggedError("MissingProfileError")<{
  readonly endpoint: string
}> {}

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly path: string
  readonly reason: string
}> {}

export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly endpoint: string
  readonly reason: string
}> {}

export class ApiError extends Data.TaggedError("ApiError")<{
  readonly status: number
  readonly message: string
}> {}

export class InvalidResponseError extends Data.TaggedError("InvalidResponseError")<{
  readonly reason: string
}> {}

export type AppError =
  | InvalidEndpointError
  | HtmlFileError
  | InvalidInkIdError
  | MissingProfileError
  | ConfigError
  | NetworkError
  | ApiError
  | InvalidResponseError
