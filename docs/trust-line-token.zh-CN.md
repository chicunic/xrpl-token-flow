# Trust Line Token

Trust Line Token 是 XRPL 上基于 [Trust Line](https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-line-tokens) 的同质化代币机制。发行者 (Issuer) 创建代币后，持有者需先建立 Trust Line 才能接收代币。

## Test Suites

### Basic Lifecycle (`basic.test.ts`)

测试完整生命周期：配置发行者 (DefaultRipple) → 建立 Trust Line → Mint → 转账 → Burn → 删除 Trust Line。

```bash
pnpm test trust-line-token/basic
```

### AllowTrustLineClawback (`allow-trustline-clawback.test.ts`)

测试 [Clawback](https://xrpl.org/docs/references/protocol/transactions/types/clawback) 功能。

| 操作 | 条件 | 预期 |
| - | - | - |
| Issuer clawback from Bob | AllowTrustLineClawback 已启用 | 成功 |
| Issuer clawback 超额 | 回收金额 > 余额 | 成功 (回收全部余额) |
| 清除 AllowTrustLineClawback | 已设置该标志 | 交易成功但标志仍保留 (不可撤销) |

```bash
pnpm test allow-trustline-clawback
```

### Check (`check.test.ts`)

测试 [XRPL Check](https://xrpl.org/docs/concepts/payment-types/checks) 功能。

| 操作 | 条件 | 预期 |
| - | - | - |
| Bob 兑现 Alice 支票 | 支票有效 | 成功 |
| Alice 取消支票 | 发送方取消 | 成功 |
| Bob 取消支票 | 接收方取消 | 成功 |
| Bob 兑现已取消支票 | 支票已被取消 | 失败 (tecNO_ENTRY) |

```bash
pnpm test trust-line-token/check
```

### DefaultRipple (`default-ripple.test.ts`)

测试 [DefaultRipple](https://xrpl.org/docs/concepts/tokens/fungible-tokens/rippling) 标志。

| 操作 | Issuer DefaultRipple | 预期 |
| - | - | - |
| Alice → Bob 转账 | 已启用 | 成功 |
| Alice → Bob 转账 | 未启用 | 失败 (tecPATH_DRY) |

```bash
pnpm test trust-line-token/default-ripple
```

### DepositAuth (`deposit-auth.test.ts`)

测试 [DepositAuth](https://xrpl.org/docs/concepts/accounts/depositauth) 标志。

| 操作 | Bob DepositAuth | DepositPreauth | 预期 |
| - | - | - | - |
| Alice → Bob USD | 已启用 | 无 | 失败 (tecNO_PERMISSION) |
| Alice → Bob XRP | 已启用 | 无 | 失败 (tecNO_PERMISSION) |
| Issuer → Bob USD (mint) | 已启用 | 无 | 失败 (tecNO_PERMISSION) |
| Bob → Alice USD | 已启用 | 无 | 成功 (出账不受限) |
| Bob → Alice XRP | 已启用 | 无 | 成功 (出账不受限) |
| Alice → Bob USD | 已启用 | Alice 已预授权 | 成功 |
| Alice → Bob XRP | 已启用 | Alice 已预授权 | 成功 |
| Alice → Bob USD | 已启用 | Alice 预授权已移除 | 失败 (tecNO_PERMISSION) |
| Alice → Bob XRP | 已启用 | Alice 预授权已移除 | 失败 (tecNO_PERMISSION) |
| Alice → Bob USD | 已禁用 | - | 成功 |
| Alice → Bob XRP | 已禁用 | - | 成功 |

```bash
pnpm test trust-line-token/deposit-auth
```

### DepositAuth + Check Flow (`deposit-auth-check-flow.test.ts`)

测试 DepositAuth 与 [Check](https://xrpl.org/docs/concepts/payment-types/checks) 的配合。

| 操作 | Bob DepositAuth | 预期 |
| - | - | - |
| Bob 兑现 Alice 支票 | 已启用 | 成功 (Check 绕过 DepositAuth) |

```bash
pnpm test trust-line-token/deposit-auth-check-flow
```

### DisallowXRP (`disallow-xrp.test.ts`)

测试 [DisallowXRP](https://xrpl.org/docs/references/protocol/transactions/types/accountset#disallowxrp) 标志。

| 操作 | Bob DisallowXRP | 预期 |
| - | - | - |
| Alice → Bob XRP | 已启用 | 成功 (仅建议性标志) |
| Bob → Alice XRP | 已启用 | 成功 |
| Alice → Bob XRP | 已禁用 | 成功 |

```bash
pnpm test trust-line-token/disallow-xrp
```

### Edge Cases (`edge-cases.test.ts`)

测试边界条件。

| 操作 | 条件 | 预期 |
| - | - | - |
| Alice → Alice 转账 | 自付款 | 失败 (temREDUNDANT) |
| Alice → Bob 转账 | amount=0 | 失败 (temBAD_AMOUNT) |
| Alice → Bob 转账 | amount > Trust Line limit | 失败 (tecPATH_PARTIAL) |
| 带 Memo 的交易 | MemoType + MemoData | 成功 |
| 删除 Trust Line | limit=0, balance=0 | 成功 |

```bash
pnpm test trust-line-token/edge-cases
```

### GlobalFreeze (`global-freeze.test.ts`)

测试 [GlobalFreeze](https://xrpl.org/docs/concepts/tokens/fungible-tokens/freezes#global-freeze) 功能。

| 操作 | GlobalFreeze | 预期 |
| - | - | - |
| Alice → Bob 转账 | 已启用 | 失败 (tecPATH_DRY) |
| Bob → Alice 转账 | 已启用 | 失败 (tecPATH_DRY) |
| Issuer → Alice mint | 已启用 | 成功 (Issuer 不受限) |
| Issuer → Bob mint | 已启用 | 成功 (Issuer 不受限) |
| Alice → Issuer burn | 已启用 | 成功 (退回 Issuer 不受限) |
| Issuer clawback | 已启用 | 成功 (Issuer 不受限) |
| Alice → Bob 转账 | 已禁用 | 成功 |

```bash
pnpm test trust-line-token/global-freeze
```

### IndividualFreeze (`individual-freeze.test.ts`)

测试 [Individual Freeze](https://xrpl.org/docs/concepts/tokens/fungible-tokens/freezes#individual-freeze) 功能。

| 操作 | 条件 | 预期 |
| - | - | - |
| Alice → Bob 转账 | Alice Trust Line 已冻结 | 失败 (tecPATH_DRY) |
| Bob → Alice 转账 | Alice Trust Line 已冻结 | 成功 (冻结仅阻止出账) |
| Bob → Bob2 转账 | Bob 未冻结 | 成功 |
| Issuer → Alice mint | Alice Trust Line 已冻结 | 成功 |
| Alice → Bob 转账 | Alice Trust Line 已解冻 | 成功 |
| Issuer 冻结任意 Trust Line | Issuer 已设置 asfNoFreeze | 失败 (tecNO_PERMISSION) |
| Issuer 清除 asfNoFreeze | 已设置 asfNoFreeze | 失败 (tecNO_PERMISSION，不可撤销) |

```bash
pnpm test trust-line-token/individual-freeze
```

### Multi-Issuer (`multi-issuer.test.ts`)

测试多发行者场景。

| 操作 | 条件 | 预期 |
| - | - | - |
| 转账 IssuerA USD | Alice 同时持有 IssuerA/B USD | 成功 (不影响 IssuerB 余额) |
| 用 IssuerB USD 支付 IssuerA USD 债务 | 不同 Issuer | 失败 (tecPATH_PARTIAL) |
| IssuerA → Alice → IssuerB rippling | DefaultRipple 启用 | 成功 |

```bash
pnpm test trust-line-token/multi-issuer
```

### NoRipple Flow (`no-ripple-flow.test.ts`)

测试 [NoRipple](https://xrpl.org/docs/concepts/tokens/fungible-tokens/rippling#using-no-ripple) 标志的手动配置流程。

| 操作 | 条件 | 预期 |
| - | - | - |
| Issuer 创建 Trust Line | DefaultRipple 未启用 | 成功 (Trust Line 默认带 NoRipple) |
| Issuer 清除 Bob NoRipple | 手动清除 | 成功 |
| Alice → Bob 转账 | Bob NoRipple 已清除 | 成功 |

```bash
pnpm test trust-line-token/no-ripple-flow
```

### RequireAuth (`require-auth.test.ts`)

测试 [RequireAuth](https://xrpl.org/docs/concepts/tokens/fungible-tokens/authorized-trust-lines) 功能。

| 操作 | Issuer RequireAuth | Trust Line 状态 | 预期 |
| - | - | - | - |
| Issuer → Alice mint | 已启用 | 已授权 | 成功 |
| Alice → Bob 转账 | 已启用 | 双方已授权 | 成功 |
| Issuer → Charlie mint | 已启用 | 未授权 | 失败 (tecPATH_DRY) |
| Alice → Charlie 转账 | 已启用 | Charlie 未授权 | 失败 (tecPATH_DRY) |
| Issuer → Charlie mint | 已清除 | 未授权 | 成功 |
| Alice → Charlie 转账 | 已清除 | 未授权 | 成功 |

```bash
pnpm test trust-line-token/require-auth
```

### Ripple Direction (`ripple-direction.test.ts`)

测试 Ripple 方向性（通过 Issuer 中转的转账路径）。

| 发送方 no_ripple_peer | 接收方 no_ripple_peer | 预期 |
| - | - | - |
| true | true | 失败 (tecPATH_DRY) |
| true | false | 成功 |
| false | true | 成功 |
| false | false | 成功 |

```bash
pnpm test trust-line-token/ripple-direction
```

### TransferRate (`transfer-rate.test.ts`)

测试 [TransferRate](https://xrpl.org/docs/concepts/tokens/transfer-fees) (转账费率) 功能。

| 操作 | TransferRate | 预期 |
| - | - | - |
| Alice → Bob 转账 | 0.5% | 成功 (扣除 0.5% 手续费) |
| Issuer → Alice mint | 0.5% | 成功 (免手续费) |
| Alice → Issuer burn | 0.5% | 成功 (免手续费) |
| Alice → Bob 转账 | 已清除 (0) | 成功 (免手续费) |

```bash
pnpm test trust-line-token/transfer-rate
```
