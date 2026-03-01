# XRPL 稳定币流

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D25-green.svg)](https://nodejs.org/)
[![XRPL](https://img.shields.io/badge/XRPL-4.x-brightgreen.svg)](https://xrpl.org/)
[![Vitest](https://img.shields.io/badge/Vitest-4.x-6E9F18.svg)](https://vitest.dev/)
[![Biome](https://img.shields.io/badge/Biome-2.x-60a5fa.svg)](https://biomejs.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-11.x-f69220.svg)](https://pnpm.io/)

一个全面的 TypeScript 测试框架，用于 XRPL (XRP 账本) 稳定币操作，具有针对各种 XRPL 账户标志和功能的广泛集成测试。

## 概述

本项目为 XRPL 稳定币流提供强大的测试环境，专注于账户配置、信任线管理、代币发行和支付操作。包含针对关键 XRPL 功能 (如 RequireAuth、DepositAuth、GlobalFreeze 和其他账户标志) 的自动化测试。

## 特性

- **全面的 XRPL 集成测试**: 覆盖所有主要 XRPL 稳定币操作的测试套件
- **账户标志测试**: RequireAuth、DepositAuth、GlobalFreeze、DisallowXRP 等
- **信任线管理**: 创建、授权和追回功能
- **支付流程测试**: 代币转账、XRP 支付和支票操作
- **自动钱包资助**: 智能钱包资助，具有余额检查和水龙头集成
- **并行操作优化**: 使用 Promise.all 优化异步操作
- **网络灵活性**: 支持 devnet、testnet 和自定义 XRPL 端点

## 项目结构

```txt
xrpl-stablecoin-flow/
├── src/
│   ├── config/
│   │   └── xrpl.config.ts          # XRPL 客户端配置
│   └── services/
│       └── fund.service.ts         # 钱包资助服务
├── tests/
│   ├── setup.ts                    # 全局测试设置 (控制台输出、生命周期钩子)
│   ├── specs/integration/          # 集成测试套件
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
│       ├── data.ts                 # 共享测试常量
│       └── test.helper.ts          # 共享测试辅助工具
├── .env.example                    # 环境变量模板
├── biome.json                      # Biome 代码检查与格式化配置
├── setup-hooks.sh                  # Git hooks 设置脚本
├── vitest.config.ts                # Vitest 配置
├── tsconfig.json                   # TypeScript 配置
└── package.json                    # 包依赖和脚本
```

## 先决条件

- **Node.js**: >=25
- **pnpm**: 包管理器

## 快速开始

1. 克隆仓库并安装依赖:

```bash
pnpm install
```

1. 复制环境变量模板并配置:

```bash
cp .env.example .env
```

1. 在 `.env` 中配置以下环境变量:

```bash
# XRPL 配置
XRPL_NETWORK=devnet                               # mainnet | testnet | devnet
# XRPL_ENDPOINT=wss://s.devnet.rippletest.net:51233  # 自定义端点 (可选)

FUND_MNEMONIC=<your-mnemonic>                      # 钱包资助助记词
```

## 脚本

| Command | Description |
| - | - |
| `pnpm test` | 运行所有测试 |
| `pnpm test <name>` | 运行指定测试套件 |
| `pnpm test:watch` | 以监听模式运行测试 |
| `pnpm test:coverage` | 运行测试并生成覆盖率报告 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm check` | 运行类型检查 + Biome 代码检查 |
| `pnpm fix` | 自动修复代码检查和格式化问题 |

## 测试套件

### 1. 账户标志测试

#### AllowTrustLineClawback (`allow-trustline-clawback.test.ts`)

测试[追回功能](https://xrpl.org/docs/references/protocol/transactions/types/clawback):

- 在发行者账户上启用追回
- 执行代币追回
- 余额调整和验证

```bash
pnpm test allow-trustline-clawback
```

#### DefaultRipple (`default-ripple.test.ts`)

测试 [DefaultRipple 标志](https://xrpl.org/docs/concepts/tokens/fungible-tokens/rippling)账户配置:

- 设置 DefaultRipple 标志
- 自动波纹传播行为
- 多跳支付场景

```bash
pnpm test default-ripple
```

#### DepositAuth (`deposit-auth.test.ts`)

测试[存款授权标志](https://xrpl.org/docs/concepts/accounts/depositauth)要求:

- 在接收者账户上设置 DepositAuth 标志
- 授权存款流程
- 支付授权机制

```bash
pnpm test deposit-auth
```

#### DisallowXRP (`disallow-xrp.test.ts`)

测试 [DisallowXRP 标志](https://xrpl.org/docs/concepts/accounts/depositauth)限制:

- 设置 DisallowXRP 标志
- 防止向已标记账户的 XRP 支付
- 仅代币交易流程

```bash
pnpm test disallow-xrp
```

#### GlobalFreeze (`global-freeze.test.ts`)

测试[全局冻结标志](https://xrpl.org/docs/concepts/tokens/fungible-tokens/freezes#global-freeze)功能:

- 在发行者账户上应用全局冻结
- 冻结期间防止代币转账
- 解冻和恢复操作

```bash
pnpm test global-freeze
```

#### IndividualFreeze (`individual-freeze.test.ts`)

测试[单独冻结](https://xrpl.org/docs/concepts/tokens/fungible-tokens/freezes#individual-freeze)功能:

- 冻结特定信任线
- 验证冻结对代币转账的影响
- 解冻信任线
- 通过 asfNoFreeze 永久放弃冻结权限

```bash
pnpm test individual-freeze
```

#### RequireAuth (`require-auth.test.ts`)

测试代币发行者的 [RequireAuth 标志](https://xrpl.org/docs/concepts/tokens/fungible-tokens/authorized-trust-lines)功能:

- 在发行者账户上设置 RequireAuth 标志
- 需要授权的信任线创建
- 代币转账授权过程
- 未授权转账预防

```bash
pnpm test require-auth
```

#### TransferRate (`transfer-rate.test.ts`)

测试[转账费率](https://xrpl.org/docs/concepts/tokens/transfer-fees)功能:

- 在发行者账户上设置转账费率
- 验证用户间转账的费用扣除
- 确认发行者操作免手续费
- 清除转账费率

```bash
pnpm test transfer-rate
```

### 2. 支付流程测试

#### NoRipple Flow (`no-ripple-flow.test.ts`)

测试 [NoRipple 标志](https://xrpl.org/docs/concepts/tokens/fungible-tokens/rippling)配置:

- 在信任线上设置 NoRipple 标志
- 防止通过账户进行波纹传播
- 直接支付路径

```bash
pnpm test no-ripple-flow
```

#### Deposit Auth Check Flow (`deposit-auth-check-flow.test.ts`)

测试带[存款授权](https://xrpl.org/docs/concepts/accounts/depositauth)的支票操作:

- 创建具有存款授权要求的支票
- 授权工作流程
- 授权支票兑现

```bash
pnpm test deposit-auth-check-flow
```

#### Multi-Issuer (`multi-issuer.test.ts`)

测试多发行者代币场景:

- 两个发行者发行相同货币代码
- 验证不同发行者的代币是独立资产
- 多发行者间的波纹传播行为

```bash
pnpm test multi-issuer
```

### 3. 支付测试

#### Check Operations (`check.test.ts`)

测试 [XRPL 支票](https://xrpl.org/docs/concepts/payment-types/checks)功能:

- 创建支付支票
- 支票授权和兑现
- 支票取消流程

```bash
pnpm test check
```

### 4. 边界条件测试

#### Edge Cases (`edge-cases.test.ts`)

测试各种边界条件和错误情况:

- 自付款拒绝 (temREDUNDANT)
- 零金额支付拒绝 (temBAD_AMOUNT)
- 超限额支付失败 (tecPATH_PARTIAL)
- 交易备注 (MemoType + MemoData)
- 信任线删除 (limit=0, balance=0)

```bash
pnpm test edge-cases
```

## 许可证

MIT
