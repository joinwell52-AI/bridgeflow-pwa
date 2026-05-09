# @codeflow/runtime

> **Phase A（Sprint S3 第一阶段）已实现 AgentRegistry + PersistentStore + RuntimeBootstrap；SessionManager 仍是 S2 设计骨架，将在 Phase B 落地。Task Scheduler / Skill Runtime / Review Engine 见路线图 Phase C / S4 / S5。**

CodeFlow AI Runtime —— 6 大 kernel 子系统中的 **2 个**（Agent Registry + Session Manager）。

- 上游设计：[`docs/design/codeflow-v2-on-fcop-sdk.md`](../../docs/design/codeflow-v2-on-fcop-sdk.md) §2.1（子系统 1 + 子系统 3）+ §3（Runtime Protocol & Schemas）
- Phase A 派单：[`docs/agents/tasks/TASK-20260509-009-PM-to-DEV.md`](../../docs/agents/tasks/TASK-20260509-009-PM-to-DEV.md)
- Sprint 路线图：[`docs/design/codeflow-v2-on-fcop-sdk.md` §10.2](../../docs/design/codeflow-v2-on-fcop-sdk.md)
- 持久化决策：[`docs/crash-recovery.md`](./docs/crash-recovery.md)

## Phase A 包内职责（v0.1）

| 子系统 / 类 | 文件 | OS 类比 | 状态 |
|---|---|---|---|
| **AgentRegistry** | `src/registry/AgentRegistry.ts` | 进程控制块表 (PCB) | ✅ Phase A 完成（6 方法 + race-defense） |
| **PersistentStore** + `JsonFileStore` | `src/registry/PersistentStore.ts` | 文件系统 + journal log | ✅ Phase A 完成（atomic-write + fsync） |
| **RuntimeBootstrap** | `src/registry/RuntimeBootstrap.ts` | init / systemd | ✅ Phase A 完成（reconciliation 同步流程） |
| **AgentSdkAdapter** + `CursorSdkAdapter` / `InMemorySdkAdapter` | `src/registry/AgentSdkAdapter.ts` | SDK 适配层 | ✅ Phase A 完成 |
| `ReconciliationReport` / `ReconciliationStrategy` | `src/types/state.ts` | 启动审计 | ✅ Phase A 完成（drift 检测留位 Phase B） |
| **SessionManager** | `src/session/SessionManager.ts` | 进程调度器（会话层） | ⏸ S2 骨架；Phase B 落地 |

### AgentRegistry 6 方法 method-by-method

| 方法 | Phase A 状态 | 关键不变量 |
|---|---|---|
| `register(spec)` | ✅ 完成 | layer=admin 在 SDK 调用前 reject；ajv 验证；SDK 失败 → agents.json 不写 |
| `resume(agentId)` | ✅ 完成 | 找不到 → `AgentNotFoundError`；SDK 失败保留原 cause；更新 `runtime_last_reconciled_at` |
| `list(filter?)` | ✅ 完成 | layer / role / status 三字段 AND-combined |
| `get(agentId)` | ✅ 完成 | 不存在返 `null`，不抛 |
| `updateRuntimeBinding(agentId, runtime)` | ✅ 完成 | 不自动触发 resume（避免副作用串联） |
| `markFailed(agentId, error)` | ✅ 完成 | 写 `status=error` + `runtime_failure` |

## 不在本包内（按 §0.7 + §10.2 sprint 边界）

| 子系统 | 在哪个 sprint 落 |
|---|---|
| `SessionManager` 6 方法实现 + `SessionStore` + `TranscriptWriter` | **Phase B**（紧接 Phase A 之后的下一刀） |
| Task Scheduler (chokidar inbox 门铃) | **Phase C** |
| Skill Runtime (per-role MCP 注入) | **S5** —— 单独的 `@codeflow/skill-runtime` 包 |
| Review Engine ⭐ | **S4** —— 单独的 `@codeflow/review-engine` 包 |
| Mobile Console / 中继 | **v0.2 S7-S10** |
| 实际调用 `Agent.create / resume` 的 spike | 仍在 [`_ignore/spike_sdk_doorbell/`](../../_ignore/spike_sdk_doorbell/) — 作为参考实现保留，**未** git-mv |

## 协议依赖纪律（Phase A 重申）

- 本包**只消费**`@codeflow/protocol`（FCoP spec 的 TS 镜像）的类型与 schema
- **不允许**在 `src/types/state.ts` 创造任何 schema 字段；只允许 *runtime 私有* 的纯运行时构造（如 `RuntimeEvent` / `ReconciliationReport` / `ReconciliationStrategy` / `SessionHandle` 句柄等）
- 任何 schema 缺口 → 写到 [`REPORT-20260509-009-DEV-to-PM.md`](../../docs/agents/tasks/) 的「待 D:\FCoP 评审字段清单」节，**不在本包内私自加**
- Phase A 实施过程中 **0 个** schema 缺口出现
- 详见设计文档 §8.0 硬规则 #4 + §3.3.1.b 唯一合法升级路径

## 目录结构

```
packages/codeflow-runtime/
├── package.json
├── tsconfig.json
├── README.md                                  ← 本文件
├── src/
│   ├── index.ts                               公开 API barrel
│   ├── registry/                              Agent Registry（§2.1 子系统 3）
│   │   ├── AgentRegistry.ts                   ✅ Phase A 完成
│   │   ├── PersistentStore.ts                 ✅ JsonFileStore (atomic-write+fsync)
│   │   ├── RuntimeBootstrap.ts                ✅ reconciliation 同步流程
│   │   ├── AgentSdkAdapter.ts                 ✅ Cursor/InMemory 两实现
│   │   ├── errors.ts                          ✅ 6 个 named error class
│   │   ├── index.ts
│   │   └── __tests__/                         16 个 node:test，全部通过
│   │       ├── AgentRegistry.test.ts          场景 1-6
│   │       ├── RuntimeBootstrap.test.ts       场景 7-9 + 11
│   │       ├── PersistentStore.test.ts        场景 10 + 5 sanity
│   │       └── helpers.ts
│   ├── session/                               Session Manager（§2.1 子系统 1）
│   │   ├── SessionManager.ts                  ⏸ S2 骨架（Phase B）
│   │   ├── RunHandle.ts
│   │   └── index.ts
│   └── types/
│       └── state.ts                           AgentRecord / SessionRecord / RuntimeEvent
│                                              + Phase A 增量：ReconciliationReport
├── fixtures/                                  样例数据（设计 review，非测试）
│   ├── agents.json                            §2.1 子系统 3 的 agents.json 样例
│   └── sessions/
│       └── valid-runtime-session-001.json
└── docs/
    └── crash-recovery.md                      4 个崩溃恢复设计决策
```

## 验收（Phase A）

| 项 | 验证方式 |
|---|---|
| 包编译通过 | `npx tsc --noEmit`（零报错） |
| 单元测试 11 场景 | `npm test`（16 测试全过；其中 11 对应 TASK-009 §必交付 6 场景） |
| `@codeflow/protocol` 包未受影响 | `cd ../codeflow-protocol && npm test`（仍 8/8 通过） |
| atomic-write 模式 | `PersistentStore.ts` 含 `writeFile(*.tmp)` + `rename` + 父目录 `fsync` 三步 |
| layer=admin 拒绝在 SDK 调用前 | 测试场景 3 spy 验证 `sdk.calls.create.length === 0` |
| RuntimeNotReady 防御 | 测试场景 11 |
| 协议依赖纪律 | `src/registry`/`src/types` 不重新声明 schema 字段，仅 `import type` from `@codeflow/protocol` |

## 跑测试

```bash
cd packages/codeflow-runtime
npm install      # 一次性
npm run typecheck   # 0 错误
npm test            # 16/16 PASS
```

## v0.1 起未来 sprint 路径

- ✅ **Phase A**（本里程碑）：AgentRegistry + PersistentStore + RuntimeBootstrap
- ⏸ **Phase B**（下一刀）：SessionManager 真实实现 + SessionStore + TranscriptWriter（决策 4 兑现）
- ⏸ **Phase C**：Task Scheduler chokidar inbox 门铃 + state_history 自动追加 + E2E mini demo
- ⏸ **S4**：Review Engine（最关键⭐）
- ⏸ **S5**：Skill Runtime + fcop 强依赖校验
- ⏸ **S6**：E2E 跑通 §0.8.3 Hello World demo

详见 [`docs/design/codeflow-v2-on-fcop-sdk.md` §10.2](../../docs/design/codeflow-v2-on-fcop-sdk.md)。
