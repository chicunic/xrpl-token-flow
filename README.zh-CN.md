# XRPL Token Flow

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D26-green.svg)](https://nodejs.org/)
[![XRPL](https://img.shields.io/badge/XRPL-5.x-brightgreen.svg)](https://xrpl.org/)

## 快速开始

安装 Node.js >=26 和 `package.json` 中指定的 pnpm 版本，然后启动 Docker（例如 Docker Desktop）。

```bash
pnpm install
pnpm test
```

测试设置会通过 Docker Compose 启动 standalone rippled，在测试期间推进账本，并在结束后停止容器；若端口 6006 上已有运行中的节点，则复用该节点并保持其运行。

默认端点为 `ws://127.0.0.1:6006`，本地测试无需环境变量文件。
若服务需要连接其他端点，可将 `.env.example` 复制为 `.env` 并设置 `XRPL_ENDPOINT`；集成测试设置仍使用本地节点。

测试文件并行运行，但同一文件内的测试共享账本状态并按顺序执行。
筛选测试时应运行整个套件：

```bash
pnpm test trust-line-token/basic
pnpm test multi-purpose-token/lock
```

钱包通过 standalone genesis 账户获得资助，并进行余额检查和序列号冲突重试。
`docker/rippled.cfg` 将本地 reserve 设置为每个账户 1 XRP、每个账户拥有的对象 0.2 XRP，并将 network ID 设置为 2，以兼容 xrpl.js 且不在交易中添加 `NetworkID` 字段。

## 命令

| 命令                 | 描述                                 |
| -------------------- | ------------------------------------ |
| `pnpm test`          | 运行全部集成测试                     |
| `pnpm test <name>`   | 运行文件路径匹配 `<name>` 的测试套件 |
| `pnpm test:watch`    | 监听文件变化并重新运行测试           |
| `pnpm test:coverage` | 生成覆盖率报告                       |
| `pnpm check`         | 检查类型、代码规范和格式             |
| `pnpm fix`           | 修复代码规范和格式问题               |
| `pnpm kb:capture`    | 运行测试并采集行为事实               |
| `pnpm kb:check`      | 对比生成章节与已提交文档             |
| `pnpm kb:docs`       | 写入有采集事实支持的章节             |
| `pnpm kb:query`      | 查询已采集的行为                     |
| `pnpm docker:up`     | 手动启动 rippled，并在测试间保持运行 |
| `pnpm docker:down`   | 停止手动启动的容器                   |

## 知识库

`docs/kb/behaviors.json` 记录尝试的操作、账本前提条件、结果和交易证据。
普通测试不采集事实；采集运行按已执行的源文件替换事实，并保留其他文件的事实。
仅 `scripts/kb-sections.ts` 中配置的章节会自动生成，其他文档章节由人工维护。

```bash
pnpm kb:query --feature deep-freeze
pnpm kb:query --code tecNO_PERMISSION
pnpm kb:query --flag lsfDepositAuth --outcome failure
pnpm kb:query --text credential --json --limit 10
```

执行 `pnpm kb:docs` 前先运行 `pnpm kb:check`，处理差异后再覆盖文档。
注解和维护约定见 [CLAUDE.md](CLAUDE.md)。

## 项目结构

| 路径            | 用途                             |
| --------------- | -------------------------------- |
| `src/config/`   | 共享 XRPL 客户端                 |
| `src/services/` | 代币、交易和账户安全操作         |
| `src/kb/`       | 行为事实类型                     |
| `tests/`        | 集成测试、账本设置和共享辅助工具 |
| `scripts/`      | 知识库采集导出、查询和文档生成   |
| `docs/`         | 中英文行为指南和采集事实         |
| `docker/`       | standalone rippled 配置          |

## 行为指南

- [Trust Line Token](docs/trust-line-token.zh-CN.md)
- [Multi-Purpose Token](docs/multi-purpose-token.zh-CN.md)

## 许可证

MIT
