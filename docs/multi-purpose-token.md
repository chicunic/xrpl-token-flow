# Multi-Purpose Token (MPT)

Multi-Purpose Token (MPT) is a [new token standard](https://xrpl.org/docs/concepts/tokens/fungible-tokens/multi-purpose-tokens) on XRPL, lighter-weight than Trust Line Tokens. Issuers create an [MPToken Issuance](https://xrpl.org/docs/references/protocol/transactions/types/mptokenissuancecreate), and holders [Authorize (opt-in)](https://xrpl.org/docs/references/protocol/transactions/types/mptokenauthorize) to hold tokens without establishing a Trust Line.

## Test Suites

### Basic Lifecycle (`basic.test.ts`)

Tests the full lifecycle: create Issuance (with metadata) → Holder Authorize → Mint → Transfer → Burn → Unauthorize → Destroy Issuance.

```bash
pnpm test multi-purpose-token/basic
```

### Clawback (`clawback.test.ts`)

Tests [Clawback](https://xrpl.org/docs/references/protocol/transactions/types/clawback) functionality.

| Operation | tfMPTCanClawback | Condition | Expected |
| - | - | - | - |
| Issuer partial clawback | Set | Clawback amount < balance | Success |
| Issuer clawback exceeding balance | Set | Clawback amount > balance | Success (claws back entire balance) |
| Issuer clawback | Not set | - | Failure (tecNO_PERMISSION) |

```bash
pnpm test multi-purpose-token/clawback
```

### Edge Cases (`edge-cases.test.ts`)

Tests boundary conditions.

| Operation | Condition | Expected |
| - | - | - |
| Mint exceeding limit | MaximumAmount reached | Failure (tecPATH_PARTIAL) |
| Alice → Bob transfer | tfMPTCanTransfer not set | Failure (tecNO_AUTH) |
| Destroy Issuance | Holders still have balance | Failure (tecHAS_OBLIGATIONS) |
| Alice double Authorize | Already authorized | Failure (tecDUPLICATE) |
| Issuer mint to Bob | Bob not authorized | Failure (tecNO_AUTH) |

```bash
pnpm test multi-purpose-token/edge-cases
```

### Lock/Unlock (`lock.test.ts`)

Tests [Lock](https://xrpl.org/docs/references/protocol/transactions/types/mptokenissuanceset) functionality.

| Operation | Lock Status | Expected |
| - | - | - |
| Alice → Bob transfer | Alice individually locked | Failure (tecLOCKED) |
| Bob → Alice transfer | Alice individually locked | Failure (tecLOCKED) |
| Issuer → Alice mint | Alice individually locked | Success (Issuer unrestricted) |
| Alice → Bob transfer | Alice unlocked | Success |
| Alice → Bob transfer | Global lock | Failure (tecLOCKED) |
| Bob → Alice transfer | Global lock | Failure (tecLOCKED) |
| Issuer → Alice mint | Global lock | Success (Issuer unrestricted) |
| Alice → Bob transfer | Global unlock | Success |

```bash
pnpm test multi-purpose-token/lock
```

### RequireAuth (`require-auth.test.ts`)

Tests [RequireAuth](https://xrpl.org/docs/references/protocol/transactions/types/mptokenauthorize) functionality.

| Operation | tfMPTRequireAuth | Issuer Approval | Expected |
| - | - | - | - |
| Issuer → Alice mint | Set | Alice not approved | Failure (tecNO_AUTH) |
| Issuer → Alice mint | Set | Alice approved | Success |
| Alice → Bob transfer | Set | Both approved | Success |
| Alice → Charlie transfer | Set | Charlie not approved | Failure (tecNO_AUTH) |

```bash
pnpm test multi-purpose-token/require-auth
```

### TransferFee (`transfer-fee.test.ts`)

Tests [TransferFee](https://xrpl.org/docs/references/protocol/transactions/types/mptokenissuancecreate#transferfee) functionality.

| Operation | TransferFee | Expected |
| - | - | - |
| Issuer → Alice mint | 1% | Success (fee-exempt) |
| Alice → Bob transfer 1000 | 1% | Success (Alice pays 1010, Bob receives 1000) |
| Bob → Issuer burn | 1% | Success (fee-exempt) |

```bash
pnpm test multi-purpose-token/transfer-fee
```
