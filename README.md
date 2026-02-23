# XRPL Stablecoin Flow

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
│   │   └── xrpl.config.ts      # XRPL client configuration
│   └── services/
│       └── fund.service.ts     # Wallet funding service
├── tests/
│   ├── specs/integration/      # Integration test suites
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
│       ├── data.ts             # Shared test constants
│       ├── mock.factory.ts     # Mock data factory
│       └── test.helper.ts     # Shared test helper utilities
├── jest.config.js              # Jest configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Package dependencies and scripts
```

## Prerequisites

- **Node.js**: ≥25.0.0
- **pnpm**: Package manager
- **TypeScript**: ^5.9.2
- **XRPL**: ^4.4.1

## Test Suites

### 1. Account Flag Tests

#### AllowTrustLineClawback (`allow-trustline-clawback.test.ts`)

Tests [clawback functionality](https://xrpl.org/docs/references/protocol/transactions/types/clawback):

- Enabling clawback on issuer accounts
- Executing token clawbacks
- Balance adjustments and validations

**Run test:**

```bash
pnpm test allow-trustline-clawback
```

#### DefaultRipple (`default-ripple.test.ts`)

Tests [DefaultRipple flag](https://xrpl.org/docs/concepts/tokens/fungible-tokens/rippling) account configuration:

- Setting DefaultRipple flag
- Automatic rippling behavior
- Multi-hop payment scenarios

**Run test:**

```bash
pnpm test default-ripple
```

#### DepositAuth (`deposit-auth.test.ts`)

Tests [DepositAuth flag](https://xrpl.org/docs/concepts/accounts/depositauth) requirements:

- Setting DepositAuth flag on recipient accounts
- Authorized deposit flows
- Payment authorization mechanisms

**Run test:**

```bash
pnpm test deposit-auth
```

#### DisallowXRP (`disallow-xrp.test.ts`)

Tests [DisallowXRP flag](https://xrpl.org/docs/concepts/accounts/depositauth) restrictions:

- Setting DisallowXRP flag
- Preventing XRP payments to flagged accounts
- Token-only transaction flows

**Run test:**

```bash
pnpm test disallow-xrp
```

#### GlobalFreeze (`global-freeze.test.ts`)

Tests [GlobalFreeze flag](https://xrpl.org/docs/concepts/tokens/fungible-tokens/freezes#global-freeze) functionality:

- Applying global freeze on issuer accounts
- Preventing token transfers during freeze
- Unfreezing and resuming operations

**Run test:**

```bash
pnpm test global-freeze
```

#### IndividualFreeze (`individual-freeze.test.ts`)

Tests [Individual Freeze](https://xrpl.org/docs/concepts/tokens/fungible-tokens/freezes#individual-freeze) functionality:

- Freezing a specific trust line
- Verifying freeze effects on token transfers
- Unfreezing a trust line
- Permanent no-freeze opt-out via asfNoFreeze

**Run test:**

```bash
pnpm test individual-freeze
```

#### RequireAuth (`require-auth.test.ts`)

Tests the [RequireAuth flag](https://xrpl.org/docs/concepts/tokens/fungible-tokens/authorized-trust-lines) functionality for token issuers:

- Setting RequireAuth flag on issuer accounts
- Trust line creation requiring authorization
- Token transfer authorization process
- Unauthorized transfer prevention

**Run test:**

```bash
pnpm test require-auth
```

#### TransferRate (`transfer-rate.test.ts`)

Tests [TransferRate](https://xrpl.org/docs/concepts/tokens/transfer-fees) functionality:

- Setting transfer fee on issuer accounts
- Verifying fee deduction on user-to-user transfers
- Confirming issuer operations are fee-exempt
- Clearing transfer rate

**Run test:**

```bash
pnpm test transfer-rate
```

### 2. Payment Flow Tests

#### NoRipple Flow (`no-ripple-flow.test.ts`)

Tests [NoRipple flag](https://xrpl.org/docs/concepts/tokens/fungible-tokens/rippling) configurations:

- Setting NoRipple flags on trust lines
- Preventing rippling through accounts
- Direct payment paths

**Run test:**

```bash
pnpm test no-ripple-flow
```

#### Deposit Auth Check Flow (`deposit-auth-check-flow.test.ts`)

Tests check operations with [deposit authorization](https://xrpl.org/docs/concepts/accounts/depositauth):

- Check creation with deposit auth requirements
- Authorization workflows
- Authorized check cashing

**Run test:**

```bash
pnpm test deposit-auth-check-flow
```

#### Multi-Issuer (`multi-issuer.test.ts`)

Tests multi-issuer token scenarios:

- Two issuers issuing the same currency code
- Verifying tokens from different issuers are distinct assets
- Rippling behavior across multiple issuers

**Run test:**

```bash
pnpm test multi-issuer
```

### 3. Payment Tests

#### Check Operations (`check.test.ts`)

Tests [XRPL Check](https://xrpl.org/docs/concepts/payment-types/checks) functionality:

- Creating payment checks
- Check authorization and cashing
- Check cancellation flows

**Run test:**

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

**Run test:**

```bash
pnpm test edge-cases
```

## License

MIT

## Keywords

- XRP
- XRPL
- Stablecoin
- TypeScript
- Testing
- Integration Tests
- Blockchain
- Cryptocurrency
