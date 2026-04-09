# Multi-Purpose Token (MPT)

Multi-Purpose Token (MPT) 是 XRPL 上的[新型代币标准](https://xrpl.org/docs/concepts/tokens/fungible-tokens/multi-purpose-tokens)，相比 Trust Line Token 更轻量。发行者创建 [MPToken Issuance](https://xrpl.org/docs/references/protocol/transactions/types/mptokenissuancecreate) 后，持有者通过 [Authorize (opt-in)](https://xrpl.org/docs/references/protocol/transactions/types/mptokenauthorize) 来持有代币，无需建立 Trust Line。

## Test Suites

### Basic Lifecycle (`basic.test.ts`)

测试完整生命周期：创建 Issuance (含 metadata) → Holder Authorize → Mint → 转账 → Burn → Unauthorize → Destroy Issuance。

```bash
pnpm test multi-purpose-token/basic
```

### Clawback (`clawback.test.ts`)

测试 [Clawback](https://xrpl.org/docs/references/protocol/transactions/types/clawback) 功能。

| 操作 | tfMPTCanClawback | 条件 | 预期 |
| - | - | - | - |
| Issuer clawback 部分 | 已设置 | 回收金额 < 余额 | 成功 |
| Issuer clawback 超额 | 已设置 | 回收金额 > 余额 | 成功 (回收全部余额) |
| Issuer clawback | 未设置 | - | 失败 (tecNO_PERMISSION) |

```bash
pnpm test multi-purpose-token/clawback
```

### Edge Cases (`edge-cases.test.ts`)

测试边界条件。

| 操作 | 条件 | 预期 |
| - | - | - |
| Mint 超出上限 | 已达 MaximumAmount | 失败 (tecPATH_PARTIAL) |
| Alice → Bob 转账 | tfMPTCanTransfer 未设置 | 失败 (tecNO_AUTH) |
| Destroy Issuance | 持有者仍有余额 | 失败 (tecHAS_OBLIGATIONS) |
| Alice 重复 Authorize | 已 Authorize | 失败 (tecDUPLICATE) |
| Issuer mint to Bob | Bob 未 Authorize | 失败 (tecNO_AUTH) |

```bash
pnpm test multi-purpose-token/edge-cases
```

### Lock/Unlock (`lock.test.ts`)

测试 [Lock](https://xrpl.org/docs/references/protocol/transactions/types/mptokenissuanceset) 功能。

| 操作 | 锁定状态 | 预期 |
| - | - | - |
| Alice → Bob 转账 | Alice 被单独锁定 | 失败 (tecLOCKED) |
| Bob → Alice 转账 | Alice 被单独锁定 | 失败 (tecLOCKED) |
| Issuer → Alice mint | Alice 被单独锁定 | 成功 (Issuer 不受限) |
| Alice → Bob 转账 | Alice 已解锁 | 成功 |
| Alice → Bob 转账 | 全局锁定 | 失败 (tecLOCKED) |
| Bob → Alice 转账 | 全局锁定 | 失败 (tecLOCKED) |
| Issuer → Alice mint | 全局锁定 | 成功 (Issuer 不受限) |
| Alice → Bob 转账 | 全局解锁 | 成功 |

```bash
pnpm test multi-purpose-token/lock
```

### RequireAuth (`require-auth.test.ts`)

测试 [RequireAuth](https://xrpl.org/docs/references/protocol/transactions/types/mptokenauthorize) 功能。

| 操作 | tfMPTRequireAuth | Issuer 批准状态 | 预期 |
| - | - | - | - |
| Issuer → Alice mint | 已设置 | Alice 未批准 | 失败 (tecNO_AUTH) |
| Issuer → Alice mint | 已设置 | Alice 已批准 | 成功 |
| Alice → Bob 转账 | 已设置 | 双方已批准 | 成功 |
| Alice → Charlie 转账 | 已设置 | Charlie 未批准 | 失败 (tecNO_AUTH) |

```bash
pnpm test multi-purpose-token/require-auth
```

### TransferFee (`transfer-fee.test.ts`)

测试 [TransferFee](https://xrpl.org/docs/references/protocol/transactions/types/mptokenissuancecreate#transferfee) 功能。

| 操作 | TransferFee | 预期 |
| - | - | - |
| Issuer → Alice mint | 1% | 成功 (免手续费) |
| Alice → Bob 转账 1000 | 1% | 成功 (Alice 扣除 1010，Bob 收到 1000) |
| Bob → Issuer burn | 1% | 成功 (免手续费) |

```bash
pnpm test multi-purpose-token/transfer-fee
```
