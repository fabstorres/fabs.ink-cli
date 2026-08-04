# fabs.ink CLI

Publish an HTML file to [fabs.ink](https://fabs.ink) from the command line.

```bash
npx @fabs.ink/cli publish index.html
```

The first publish creates a generated publisher identity. The CLI stores the
one-time token returned by the server and replaces it after every successful
publish, so later pages keep the same publisher subdomain.

## Development

This project uses Bun, Effect, `@effect/cli`, and `@effect/platform`.

```bash
bun install
bun run verify
bun run src/cli.ts --help
```

To publish against a local server:

```bash
cargo run --manifest-path ../fabs_ink-server/Cargo.toml
bun run src/cli.ts config set-endpoint http://127.0.0.1:3000
bun run src/cli.ts publish index.html
```

The CLI creates `~/.fabs.ink/config.json` when configuration or credentials are
first saved. No project `.env` file is needed. Inspect the effective endpoint
and config location with:

```bash
bun run src/cli.ts config
```

Endpoint selection uses this precedence:

1. `--endpoint URL` for a single command
2. An inline `FABS_INK_API_URL` environment variable
3. The endpoint saved in `~/.fabs.ink/config.json`
4. `https://fabs.ink` as the production default

For example, CI or a one-off local run can override the endpoint without
changing the config file:

```bash
FABS_INK_API_URL=http://127.0.0.1:3000 bun run src/cli.ts publish index.html
```

Reset to production with `bun run src/cli.ts config reset-endpoint`. Publisher
credentials are stored in the same config file and isolated per endpoint, so
local and production tokens do not overwrite each other. Because it contains
tokens, the CLI writes the file with owner-only permissions.

## Commands

```text
fabs.ink publish <file> [--endpoint URL] [--json]
fabs.ink whoami [--endpoint URL] [--json]
fabs.ink logout [--endpoint URL]
fabs.ink config [--json]
fabs.ink config set-endpoint <url>
fabs.ink config reset-endpoint
```

`--json` intentionally omits the rotating auth token because the CLI manages it
as a local credential.

## Package naming

npm requires scoped packages to contain both a scope and a package name, so
`@fabs.ink` alone cannot be published as an npm package. The valid package name
is `@fabs.ink/cli`, producing the invocation shown above. Once installed, both
`fabs.ink` and `fabs-ink` binaries are available.
