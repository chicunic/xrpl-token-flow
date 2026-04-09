# Trust Line Token

Trust Line Token is a fungible token mechanism on XRPL based on [Trust Lines](https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-line-tokens). Holders must establish a Trust Line with the Issuer before receiving tokens.

## Test Suites

### Basic Lifecycle (`basic.test.ts`)

Tests the full lifecycle: configure Issuer (DefaultRipple) → create Trust Line → Mint → Transfer → Burn → delete Trust Line.

```bash
pnpm test trust-line-token/basic
```

### AllowTrustLineClawback (`allow-trustline-clawback.test.ts`)

Tests [Clawback](https://xrpl.org/docs/references/protocol/transactions/types/clawback) functionality.

| Operation | Condition | Expected |
| - | - | - |
| Issuer clawback from Bob | AllowTrustLineClawback enabled | Success |
| Issuer clawback exceeding balance | Clawback amount > balance | Success (claws back entire balance) |
| Clear AllowTrustLineClawback | Flag already set | Transaction succeeds but flag remains (irreversible) |

```bash
pnpm test allow-trustline-clawback
```

### Check (`check.test.ts`)

Tests [XRPL Check](https://xrpl.org/docs/concepts/payment-types/checks) functionality.

| Operation | Condition | Expected |
| - | - | - |
| Bob cashes Alice's check | Check is valid | Success |
| Alice cancels check | Sender cancels | Success |
| Bob cancels check | Receiver cancels | Success |
| Bob cashes canceled check | Check already canceled | Failure (tecNO_ENTRY) |

```bash
pnpm test trust-line-token/check
```

### DefaultRipple (`default-ripple.test.ts`)

Tests the [DefaultRipple](https://xrpl.org/docs/concepts/tokens/fungible-tokens/rippling) flag.

| Operation | Issuer DefaultRipple | Expected |
| - | - | - |
| Alice → Bob transfer | Enabled | Success |
| Alice → Bob transfer | Disabled | Failure (tecPATH_DRY) |

```bash
pnpm test trust-line-token/default-ripple
```

### DepositAuth (`deposit-auth.test.ts`)

Tests the [DepositAuth](https://xrpl.org/docs/concepts/accounts/depositauth) flag.

| Operation | Bob DepositAuth | DepositPreauth | Expected |
| - | - | - | - |
| Alice → Bob USD | Enabled | None | Failure (tecNO_PERMISSION) |
| Alice → Bob XRP | Enabled | None | Failure (tecNO_PERMISSION) |
| Issuer → Bob USD (mint) | Enabled | None | Failure (tecNO_PERMISSION) |
| Bob → Alice USD | Enabled | None | Success (outgoing unrestricted) |
| Bob → Alice XRP | Enabled | None | Success (outgoing unrestricted) |
| Alice → Bob USD | Enabled | Alice preauthorized | Success |
| Alice → Bob XRP | Enabled | Alice preauthorized | Success |
| Alice → Bob USD | Enabled | Alice preauth removed | Failure (tecNO_PERMISSION) |
| Alice → Bob XRP | Enabled | Alice preauth removed | Failure (tecNO_PERMISSION) |
| Alice → Bob USD | Disabled | - | Success |
| Alice → Bob XRP | Disabled | - | Success |

```bash
pnpm test trust-line-token/deposit-auth
```

### DepositAuth + Check Flow (`deposit-auth-check-flow.test.ts`)

Tests DepositAuth combined with [Check](https://xrpl.org/docs/concepts/payment-types/checks).

| Operation | Bob DepositAuth | Expected |
| - | - | - |
| Bob cashes Alice's check | Enabled | Success (Check bypasses DepositAuth) |

```bash
pnpm test trust-line-token/deposit-auth-check-flow
```

### DisallowXRP (`disallow-xrp.test.ts`)

Tests the [DisallowXRP](https://xrpl.org/docs/references/protocol/transactions/types/accountset#disallowxrp) flag.

| Operation | Bob DisallowXRP | Expected |
| - | - | - |
| Alice → Bob XRP | Enabled | Success (advisory flag only) |
| Bob → Alice XRP | Enabled | Success |
| Alice → Bob XRP | Disabled | Success |

```bash
pnpm test trust-line-token/disallow-xrp
```

### Edge Cases (`edge-cases.test.ts`)

Tests boundary conditions.

| Operation | Condition | Expected |
| - | - | - |
| Alice → Alice transfer | Self-payment | Failure (temREDUNDANT) |
| Alice → Bob transfer | amount=0 | Failure (temBAD_AMOUNT) |
| Alice → Bob transfer | amount > Trust Line limit | Failure (tecPATH_PARTIAL) |
| Transaction with Memo | MemoType + MemoData | Success |
| Delete Trust Line | limit=0, balance=0 | Success |

```bash
pnpm test trust-line-token/edge-cases
```

### GlobalFreeze (`global-freeze.test.ts`)

Tests [GlobalFreeze](https://xrpl.org/docs/concepts/tokens/fungible-tokens/freezes#global-freeze) functionality.

| Operation | GlobalFreeze | Expected |
| - | - | - |
| Alice → Bob transfer | Enabled | Failure (tecPATH_DRY) |
| Bob → Alice transfer | Enabled | Failure (tecPATH_DRY) |
| Issuer → Alice mint | Enabled | Success (Issuer unrestricted) |
| Issuer → Bob mint | Enabled | Success (Issuer unrestricted) |
| Alice → Issuer burn | Enabled | Success (return to Issuer unrestricted) |
| Issuer clawback | Enabled | Success (Issuer unrestricted) |
| Alice → Bob transfer | Disabled | Success |

```bash
pnpm test trust-line-token/global-freeze
```

### IndividualFreeze (`individual-freeze.test.ts`)

Tests [Individual Freeze](https://xrpl.org/docs/concepts/tokens/fungible-tokens/freezes#individual-freeze) functionality.

| Operation | Condition | Expected |
| - | - | - |
| Alice → Bob transfer | Alice Trust Line frozen | Failure (tecPATH_DRY) |
| Bob → Alice transfer | Alice Trust Line frozen | Success (freeze only blocks outgoing) |
| Bob → Bob2 transfer | Bob not frozen | Success |
| Issuer → Alice mint | Alice Trust Line frozen | Success |
| Alice → Bob transfer | Alice Trust Line unfrozen | Success |
| Issuer freezes any Trust Line | Issuer set asfNoFreeze | Failure (tecNO_PERMISSION) |
| Issuer clears asfNoFreeze | asfNoFreeze set | Failure (tecNO_PERMISSION, irreversible) |

```bash
pnpm test trust-line-token/individual-freeze
```

### Multi-Issuer (`multi-issuer.test.ts`)

Tests multi-issuer scenarios.

| Operation | Condition | Expected |
| - | - | - |
| Transfer IssuerA USD | Alice holds both IssuerA/B USD | Success (IssuerB balance unaffected) |
| Pay IssuerA USD debt with IssuerB USD | Different Issuers | Failure (tecPATH_PARTIAL) |
| IssuerA → Alice → IssuerB rippling | DefaultRipple enabled | Success |

```bash
pnpm test trust-line-token/multi-issuer
```

### NoRipple Flow (`no-ripple-flow.test.ts`)

Tests manual configuration of the [NoRipple](https://xrpl.org/docs/concepts/tokens/fungible-tokens/rippling#using-no-ripple) flag.

| Operation | Condition | Expected |
| - | - | - |
| Issuer creates Trust Line | DefaultRipple disabled | Success (Trust Line defaults to NoRipple) |
| Issuer clears Bob's NoRipple | Manual clear | Success |
| Alice → Bob transfer | Bob NoRipple cleared | Success |

```bash
pnpm test trust-line-token/no-ripple-flow
```

### RequireAuth (`require-auth.test.ts`)

Tests [RequireAuth](https://xrpl.org/docs/concepts/tokens/fungible-tokens/authorized-trust-lines) functionality.

| Operation | Issuer RequireAuth | Trust Line Status | Expected |
| - | - | - | - |
| Issuer → Alice mint | Enabled | Authorized | Success |
| Alice → Bob transfer | Enabled | Both authorized | Success |
| Issuer → Charlie mint | Enabled | Unauthorized | Failure (tecPATH_DRY) |
| Alice → Charlie transfer | Enabled | Charlie unauthorized | Failure (tecPATH_DRY) |
| Issuer → Charlie mint | Cleared | Unauthorized | Success |
| Alice → Charlie transfer | Cleared | Unauthorized | Success |

```bash
pnpm test trust-line-token/require-auth
```

### Ripple Direction (`ripple-direction.test.ts`)

Tests ripple directionality (transfer paths through Issuer).

| Sender no_ripple_peer | Receiver no_ripple_peer | Expected |
| - | - | - |
| true | true | Failure (tecPATH_DRY) |
| true | false | Success |
| false | true | Success |
| false | false | Success |

```bash
pnpm test trust-line-token/ripple-direction
```

### TransferRate (`transfer-rate.test.ts`)

Tests [TransferRate](https://xrpl.org/docs/concepts/tokens/transfer-fees) functionality.

| Operation | TransferRate | Expected |
| - | - | - |
| Alice → Bob transfer | 0.5% | Success (0.5% fee deducted) |
| Issuer → Alice mint | 0.5% | Success (fee-exempt) |
| Alice → Issuer burn | 0.5% | Success (fee-exempt) |
| Alice → Bob transfer | Cleared (0) | Success (fee-exempt) |

```bash
pnpm test trust-line-token/transfer-rate
```
