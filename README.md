# XRPL Token Flow

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D26-green.svg)](https://nodejs.org/)
[![XRPL](https://img.shields.io/badge/XRPL-5.x-brightgreen.svg)](https://xrpl.org/)

## Getting Started

Install Node.js >=26 and the pnpm version specified in `package.json`, then start Docker (for example, Docker Desktop).

```bash
pnpm install
pnpm test
```

The test setup starts a standalone rippled with Docker Compose, advances ledgers while tests run, and stops the container afterward; an already-running node on port 6006 is reused and left running.

The default endpoint is `ws://127.0.0.1:6006`, so no environment file is needed for local tests.
For service use with a different endpoint, copy `.env.example` to `.env` and set `XRPL_ENDPOINT`; the integration test setup still uses the local node.

Test files run in parallel, but tests within each file share ledger state and run sequentially.
Run a whole suite when filtering tests:

```bash
pnpm test trust-line-token/basic
pnpm test multi-purpose-token/lock
```

Wallets are funded from the standalone genesis account, with balance checks and retries for sequence collisions.
The local configuration in `docker/rippled.cfg` sets reserves to 1 XRP per account and 0.2 XRP per owned object, and sets network ID 2 for xrpl.js compatibility without adding a `NetworkID` transaction field.

## Commands

| Command              | Description                                     |
| -------------------- | ----------------------------------------------- |
| `pnpm test`          | Run all integration tests                       |
| `pnpm test <name>`   | Run suites whose file paths match `<name>`      |
| `pnpm test:watch`    | Watch and rerun tests                           |
| `pnpm test:coverage` | Generate coverage reports                       |
| `pnpm check`         | Check types, lint, and formatting               |
| `pnpm fix`           | Fix lint and formatting issues                  |
| `pnpm kb:capture`    | Run tests and capture behavior facts            |
| `pnpm kb:check`      | Compare generated sections with committed docs  |
| `pnpm kb:docs`       | Write sections backed by captured facts         |
| `pnpm kb:query`      | Query captured behaviors                        |
| `pnpm docker:up`     | Start rippled manually and keep it between runs |
| `pnpm docker:down`   | Stop the manually started container             |

## Knowledge Base

`docs/kb/behaviors.json` records attempted operations, ledger preconditions, outcomes, and transaction evidence.
Capture is disabled during ordinary tests; capture runs replace facts per executed source file and preserve facts from other files.
Only sections configured in `scripts/kb-sections.ts` are generated; the other documentation sections are maintained manually.

```bash
pnpm kb:query --feature deep-freeze
pnpm kb:query --code tecNO_PERMISSION
pnpm kb:query --flag lsfDepositAuth --outcome failure
pnpm kb:query --text credential --json --limit 10
```

Run `pnpm kb:check` before `pnpm kb:docs` and resolve any drift before overwriting documentation.
See [CLAUDE.md](CLAUDE.md) for annotation and maintenance conventions.

## Project Layout

| Path            | Purpose                                                |
| --------------- | ------------------------------------------------------ |
| `src/config/`   | Shared XRPL client                                     |
| `src/services/` | Token, transaction, and account security operations    |
| `src/kb/`       | Behavior fact types                                    |
| `tests/`        | Integration suites, ledger setup, and shared helpers   |
| `scripts/`      | Knowledge-base capture export, queries, and rendering  |
| `docs/`         | English and Chinese behavior guides and captured facts |
| `docker/`       | Standalone rippled configuration                       |

## Behavior Guides

- [Trust Line Token](docs/trust-line-token.md)
- [Multi-Purpose Token](docs/multi-purpose-token.md)

## License

MIT
