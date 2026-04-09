# XRPL Stablecoin Flow

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D25-green.svg)](https://nodejs.org/)
[![XRPL](https://img.shields.io/badge/XRPL-4.x-brightgreen.svg)](https://xrpl.org/)
[![Vitest](https://img.shields.io/badge/Vitest-4.x-6E9F18.svg)](https://vitest.dev/)
[![Biome](https://img.shields.io/badge/Biome-2.x-60a5fa.svg)](https://biomejs.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-11.x-f69220.svg)](https://pnpm.io/)

A comprehensive TypeScript testing framework for XRPL (XRP Ledger) stablecoin operations, featuring extensive integration tests for various XRPL account flags and features.

## Overview

This project provides a robust testing environment for XRPL stablecoin flows, focusing on account configuration, trust line management, token issuance, and payment operations. It includes automated testing for critical XRPL features like RequireAuth, DepositAuth, GlobalFreeze, and other account flags.

## Features

- **Comprehensive XRPL Integration Testing**: Test suites covering all major XRPL stablecoin operations
- **Account Flag Testing**: RequireAuth, DepositAuth, GlobalFreeze, DisallowXRP, and more
- **Trust Line Management**: Creation, authorization, and clawback functionality
- **Payment Flow Testing**: Token transfers, XRP payments, and check operations
- **Automated Wallet Funding**: Smart wallet funding with balance checking and faucet integration
- **Parallel Operation Optimization**: Optimized async operations using Promise.all
- **Network Flexibility**: Support for devnet, testnet, and custom XRPL endpoints

## Project Structure

```txt
xrpl-stablecoin-flow/
├── src/
│   ├── config/
│   │   └── xrpl.config.ts              # XRPL client configuration
│   └── services/
│       └── fund.service.ts             # Wallet funding service
├── tests/
│   ├── setup.ts                        # Global test setup
│   ├── specs/integration/
│   │   ├── trust-line-token/           # Trust Line Token test suites
│   │   └── multi-purpose-token/        # Multi-Purpose Token test suites
│   └── utils/                          # Shared test helpers
├── docs/                               # Documentation
├── biome.json                          # Biome linter & formatter
├── vitest.config.ts                    # Vitest configuration
├── tsconfig.json                       # TypeScript configuration
└── package.json                        # Package dependencies and scripts
```

## Prerequisites

- **Node.js**: >=25
- **pnpm**: Package manager

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
XRPL_NETWORK=devnet                                  # mainnet | testnet | devnet
# XRPL_ENDPOINT=wss://s.devnet.rippletest.net:51233  # Custom endpoint (optional)

FUND_SECRET=<your-secret>                              # Secret key for wallet funding
```

## Scripts

| Command | Description |
| - | - |
| `pnpm test` | Run all tests |
| `pnpm test <name>` | Run a specific test suite |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm check` | Run type checking + Biome linting |
| `pnpm fix` | Auto-fix linting and formatting issues |

## Test Suites

| Category | Documentation |
| - | - |
| Trust Line Token | [docs/trust-line-token.md](docs/trust-line-token.md) |
| Multi-Purpose Token | [docs/multi-purpose-token.md](docs/multi-purpose-token.md) |

## License

MIT
