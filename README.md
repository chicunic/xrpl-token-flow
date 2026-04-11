# XRPL Token Flow

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24-green.svg)](https://nodejs.org/)
[![XRPL](https://img.shields.io/badge/XRPL-4.x-brightgreen.svg)](https://xrpl.org/)
[![Vitest](https://img.shields.io/badge/Vitest-4.x-6E9F18.svg)](https://vitest.dev/)
[![Biome](https://img.shields.io/badge/Biome-2.x-60a5fa.svg)](https://biomejs.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-f69220.svg)](https://pnpm.io/)

A comprehensive TypeScript testing framework for XRPL (XRP Ledger) token operations, featuring extensive integration tests for various XRPL account flags and features.

## Overview

This project provides a robust testing environment for XRPL token flows, focusing on account configuration, trust line management, token issuance, and payment operations. It includes automated testing for critical XRPL features like RequireAuth, DepositAuth, GlobalFreeze, and other account flags.

## Features

- **Comprehensive XRPL Integration Testing**: Test suites covering all major XRPL token operations
- **Account Flag Testing**: RequireAuth, DepositAuth, GlobalFreeze, DisallowXRP, and more
- **Trust Line Management**: Creation, authorization, and clawback functionality
- **Payment Flow Testing**: Token transfers, XRP payments, and check operations
- **Automated Wallet Funding**: Smart wallet funding with balance checking and faucet integration
- **Parallel Operation Optimization**: Optimized async operations using Promise.all
- **Network Flexibility**: Support for devnet, testnet, local (Docker), and custom XRPL endpoints

## Project Structure

```txt
xrpl-token-flow/
├── src/
│   ├── config/
│   │   └── xrpl.config.ts              # XRPL client configuration
│   └── services/
│       └── fund.service.ts             # Wallet funding service
├── tests/
│   ├── setup.ts                        # Global test setup (devnet/testnet)
│   ├── setup-local.ts                  # Local Docker test setup
│   ├── tsconfig.json                   # Tests TypeScript configuration
│   ├── specs/integration/
│   │   ├── trust-line-token/           # Trust Line Token test suites
│   │   └── multi-purpose-token/        # Multi-Purpose Token test suites
│   └── utils/                          # Shared test helpers
├── docker/                             # Docker rippled configuration
├── docs/                               # Documentation
├── biome.json                          # Biome linter & formatter
├── docker-compose.yaml                 # Local rippled container
├── vitest.config.ts                    # Vitest configuration (devnet)
├── vitest.config.local.ts              # Vitest configuration (local Docker)
├── tsconfig.json                       # TypeScript configuration
└── package.json                        # Package dependencies and scripts
```

## Prerequisites

- **Node.js**: >=24
- **pnpm**: Package manager
- **Docker**: Required for local network testing

## Getting Started

1. Clone the repository and install dependencies:

```bash
pnpm install
```

1. Copy the environment variable template and configure:

```bash
cp .env.example .env
```

1. Configure the following environment variables in `.env`:

```env
# XRPL Configuration
XRPL_NETWORK=devnet                                  # mainnet | testnet | devnet | local
# XRPL_ENDPOINT=wss://s.devnet.rippletest.net:51233  # Custom endpoint (optional)

FUND_SECRET=<your-secret>                              # Secret key for wallet funding (not needed for local)
```

## Local Network Testing

Run tests against a local standalone rippled in Docker — no faucet or secret key needed. The local node uses the genesis account for wallet funding and is configured with mainnet-matching reserves (1 XRP base / 0.2 XRP owner) via the `[voting]` stanza in `docker/rippled.cfg` ([rippled 1.11.0+](https://github.com/XRPLF/rippled/pull/4319)).

```bash
# Start rippled container
pnpm docker:up

# Run tests against local network
pnpm test:local

# Stop rippled container
pnpm docker:down
```

## Scripts

| Command | Description |
| - | - |
| `pnpm test` | Run all tests (devnet) |
| `pnpm test:local` | Run all tests against local Docker rippled |
| `pnpm test <name>` | Run a specific test suite |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm check` | Run type checking + Biome linting |
| `pnpm fix` | Auto-fix linting and formatting issues |
| `pnpm docker:up` | Start local rippled container |
| `pnpm docker:down` | Stop local rippled container |

## Test Suites

| Category | Documentation |
| - | - |
| Trust Line Token | [docs/trust-line-token.md](docs/trust-line-token.md) |
| Multi-Purpose Token | [docs/multi-purpose-token.md](docs/multi-purpose-token.md) |

## License

MIT
