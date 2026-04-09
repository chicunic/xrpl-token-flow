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
│   │   └── xrpl.config.ts              # XRPL 客户端配置
│   └── services/
│       └── fund.service.ts             # 钱包资助服务
├── tests/
│   ├── setup.ts                        # 全局测试设置
│   ├── specs/integration/
│   │   ├── trust-line-token/           # Trust Line Token 测试套件
│   │   └── multi-purpose-token/        # Multi-Purpose Token 测试套件
│   └── utils/                          # 共享测试辅助工具
├── docs/                               # 文档
├── biome.json                          # Biome 代码检查与格式化
├── vitest.config.ts                    # Vitest 配置
├── tsconfig.json                       # TypeScript 配置
└── package.json                        # 包依赖和脚本
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

```env
# XRPL 配置
XRPL_NETWORK=devnet                                  # mainnet | testnet | devnet
# XRPL_ENDPOINT=wss://s.devnet.rippletest.net:51233  # 自定义端点 (可选)

FUND_SECRET=<your-secret>                              # 钱包资助密钥
```

## 脚本

| 命令 | 描述 |
| - | - |
| `pnpm test` | 运行所有测试 |
| `pnpm test <name>` | 运行指定测试套件 |
| `pnpm test:watch` | 以监听模式运行测试 |
| `pnpm test:coverage` | 运行测试并生成覆盖率报告 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm check` | 运行类型检查 + Biome 代码检查 |
| `pnpm fix` | 自动修复代码检查和格式化问题 |

## 测试套件

| 分类 | 文档 |
| - | - |
| Trust Line Token | [docs/trust-line-token.zh-CN.md](docs/trust-line-token.zh-CN.md) |
| Multi-Purpose Token | [docs/multi-purpose-token.zh-CN.md](docs/multi-purpose-token.zh-CN.md) |

## 许可证

MIT
