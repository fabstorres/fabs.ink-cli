# fabs.ink CLI

Publish HTML files to [fabs.ink](https://fabs.ink) from the command line.

## Installation

[Install Bun](https://bun.sh), then install the CLI globally:

```bash
bun add --global @fabs.ink/cli
```

## Quick start

Publish an HTML file:

```bash
fabs.ink publish index.html
```

Your first publish creates a guest identity. Future publishes reuse that
identity so your pages stay on the same publisher subdomain.

Create an account when you are ready to keep that identity:

```bash
fabs.ink signup
```

Use `login` when signing in to an existing account on another machine:

```bash
fabs.ink login
```

If the current machine has guest pages you want to keep, use `signup` instead
so those pages can move to your new account.

## Manage documents

Use `--json` when publishing to get the document ID:

```bash
fabs.ink publish index.html --json
```

Pass that ID to `update` or `delete`:

```bash
fabs.ink update DOCUMENT_ID replacement.html
fabs.ink delete DOCUMENT_ID
```

## Commands

```text
fabs.ink publish <file> [--endpoint URL] [--json]
fabs.ink signup [--endpoint URL]
fabs.ink login [--endpoint URL]
fabs.ink update <id> <file> [--endpoint URL] [--json]
fabs.ink delete <id> [--endpoint URL] [--json]
fabs.ink whoami [--endpoint URL] [--json]
fabs.ink logout [--endpoint URL]
fabs.ink config [--json]
fabs.ink config set-endpoint <url>
fabs.ink config reset-endpoint
```

Run `fabs.ink --help` or `fabs.ink <command> --help` for more details.

## Development

```bash
bun install
bun run verify
bun run src/cli.ts --help
```

To use a local fabs.ink server:

```bash
bun run src/cli.ts config set-endpoint http://127.0.0.1:3000
bun run src/cli.ts publish index.html
```

Restore the production endpoint with:

```bash
bun run src/cli.ts config reset-endpoint
```
