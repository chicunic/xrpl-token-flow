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
│   │   └── xrpl.config.ts          # XRPL client configuration
│   └── services/
│       └── fund.service.ts         # Wallet funding service
├── tests/
│   ├── setup.ts                    # Global test setup (console output, lifecycle hooks)
│   ├── specs/integration/          # Integration test suites
│   │   ├── allow-trustline-clawback.test.ts
│   │   ├── check.test.ts
│   │   ├── default-ripple.test.ts
│   │   ├── deposit-auth-check-flow.test.ts
│   │   ├── deposit-auth.test.ts
│   │   ├── disallow-xrp.test.ts
│   │   ├── edge-cases.test.ts
│   │   ├── global-freeze.test.ts
│   │   ├── individual-freeze.test.ts
│   │   ├── multi-issuer.test.ts
│   │   ├── no-ripple-flow.test.ts
│   │   ├── require-auth.test.ts
│   │   └── transfer-rate.test.ts
│   └── utils/
│       ├── data.ts                 # Shared test constants
│       └── test.helper.ts          # Shared test helper utilities
├── .env.example                    # Environment variable template
├── biome.json                      # Biome linter & formatter configuration
├── setup-hooks.sh                  # Git hooks setup script
├── vitest.config.ts                # Vitest configuration
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Package dependencies and scripts
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

```bash
# XRPL Configuration
XRPL_NETWORK=devnet                               # mainnet | testnet | devnet
# XRPL_ENDPOINT=wss://s.devnet.rippletest.net:51233  # Custom endpoint (optional)

FUND_MNEMONIC=<your-mnemonic>                      # Mnemonic for wallet funding
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

### 1. Account Flag Tests

#### AllowTrustLineClawback (`allow-trustline-clawback.test.ts`)

Tests [clawback functionality](https://xrpl.org/docs/references/protocol/transactions/types/clawback):

- Enabling clawback on issuer accounts
- Executing token clawbacks
- Balance adjustments and validations

```bash
pnpm test allow-trustline-clawback
```

#### DefaultRipple (`default-ripple.test.ts`)

Tests [DefaultRipple flag](https://xrpl.org/docs/concepts/tokens/fungible-tokens/rippling) account configuration:

- Setting DefaultRipple flag
- Automatic rippling behavior
- Multi-hop payment scenarios

```bash
pnpm test default-ripple
```

#### DepositAuth (`deposit-auth.test.ts`)

Tests [DepositAuth flag](https://xrpl.org/docs/concepts/accounts/depositauth) requirements:

- Setting DepositAuth flag on recipient accounts
- Authorized deposit flows
- Payment authorization mechanisms

```bash
pnpm test deposit-auth
```

#### DisallowXRP (`disallow-xrp.test.ts`)

Tests [DisallowXRP flag](https://xrpl.org/docs/concepts/accounts/depositauth) restrictions:

- Setting DisallowXRP flag
- Preventing XRP payments to flagged accounts
- Token-only transaction flows

```bash
pnpm test disallow-xrp
```

#### GlobalFreeze (`global-freeze.test.ts`)

Tests [GlobalFreeze flag](https://xrpl.org/docs/concepts/tokens/fungible-tokens/freezes#global-freeze) functionality:

- Applying global freeze on issuer accounts
- Preventing token transfers during freeze
- Unfreezing and resuming operations

```bash
pnpm test global-freeze
```

#### IndividualFreeze (`individual-freeze.test.ts`)

Tests [Individual Freeze](https://xrpl.org/docs/concepts/tokens/fungible-tokens/freezes#individual-freeze) functionality:

- Freezing a specific trust line
- Verifying freeze effects on token transfers
- Unfreezing a trust line
- Permanent no-freeze opt-out via asfNoFreeze

```bash
pnpm test individual-freeze
```

#### RequireAuth (`require-auth.test.ts`)

Tests the [RequireAuth flag](https://xrpl.org/docs/concepts/tokens/fungible-tokens/authorized-trust-lines) functionality for token issuers:

- Setting RequireAuth flag on issuer accounts
- Trust line creation requiring authorization
- Token transfer authorization process
- Unauthorized transfer prevention

```bash
pnpm test require-auth
```

#### TransferRate (`transfer-rate.test.ts`)

Tests [TransferRate](https://xrpl.org/docs/concepts/tokens/transfer-fees) functionality:

- Setting transfer fee on issuer accounts
- Verifying fee deduction on user-to-user transfers
- Confirming issuer operations are fee-exempt
- Clearing transfer rate

```bash
pnpm test transfer-rate
```

### 2. Payment Flow Tests

#### NoRipple Flow (`no-ripple-flow.test.ts`)

Tests [NoRipple flag](https://xrpl.org/docs/concepts/tokens/fungible-tokens/rippling) configurations:

- Setting NoRipple flags on trust lines
- Preventing rippling through accounts
- Direct payment paths

```bash
pnpm test no-ripple-flow
```

#### Deposit Auth Check Flow (`deposit-auth-check-flow.test.ts`)

Tests check operations with [deposit authorization](https://xrpl.org/docs/concepts/accounts/depositauth):

- Check creation with deposit auth requirements
- Authorization workflows
- Authorized check cashing

```bash
pnpm test deposit-auth-check-flow
```

#### Multi-Issuer (`multi-issuer.test.ts`)

Tests multi-issuer token scenarios:

- Two issuers issuing the same currency code
- Verifying tokens from different issuers are distinct assets
- Rippling behavior across multiple issuers

```bash
pnpm test multi-issuer
```

### 3. Payment Tests

#### Check Operations (`check.test.ts`)

Tests [XRPL Check](https://xrpl.org/docs/concepts/payment-types/checks) functionality:

- Creating payment checks
- Check authorization and cashing
- Check cancellation flows

```bash
pnpm test check
```

### 4. Edge Case Tests

#### Edge Cases (`edge-cases.test.ts`)

Tests various boundary and error conditions:

- Self-payment rejection (temREDUNDANT)
- Zero amount payment rejection (temBAD_AMOUNT)
- Over-limit payment failure (tecPATH_PARTIAL)
- Transaction memo (MemoType + MemoData)
- Trust line deletion (limit=0, balance=0)

```bash
pnpm test edge-cases
```

## License

MIT
