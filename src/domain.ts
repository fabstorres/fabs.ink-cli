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

export const ProfileKindSchema = Schema.Literal("guest", "user")

export const ProfileSchema = Schema.Struct({
  name: Schema.String,
  authToken: Schema.String,
  // Profiles written before OAuth support have no kind and decode as guests.
  kind: Schema.optionalWith(ProfileKindSchema, { default: () => "guest" as const }),
})

export type Profile = typeof ProfileSchema.Type

export const DeviceCodeResponseSchema = Schema.Struct({
  device_code: Schema.NonEmptyString,
  user_code: Schema.NonEmptyString,
  verification_uri: Schema.NonEmptyString,
  verification_uri_complete: Schema.NonEmptyString,
  expires_in: Schema.Number.pipe(Schema.int(), Schema.positive()),
  interval: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

export type DeviceCodeResponse = typeof DeviceCodeResponseSchema.Type

export const DeviceTokenResponseSchema = Schema.Struct({
  access_token: Schema.NonEmptyString,
  token_type: Schema.Literal("Bearer"),
  handle: Schema.NonEmptyString,
})

export type DeviceTokenResponse = typeof DeviceTokenResponseSchema.Type

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

export class DeviceAuthorizationExpiredError extends Data.TaggedError(
  "DeviceAuthorizationExpiredError",
)<{}> {}

export type AppError =
  | InvalidEndpointError
  | HtmlFileError
  | InvalidInkIdError
  | MissingProfileError
  | ConfigError
  | NetworkError
  | ApiError
  | InvalidResponseError
  | DeviceAuthorizationExpiredError
