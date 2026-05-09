# @codeflow/runtime

> **本包当前为 Sprint S2 设计骨架，方法体未实现，将在 S3 / S4 / S5 sprint 落地。**
>
> 不要把它当成可运行的 Runtime；现在跑任何 method 都会 `throw new Error("[S2 skeleton] ...")`。

CodeFlow AI Runtime —— 6 大 kernel 子系统中的 **2 个**（Agent Registry + Session Manager）的接口骨架。

- 上游设计：[`docs/design/codeflow-v2-on-fcop-sdk.md`](../../docs/design/codeflow-v2-on-fcop-sdk.md) §2.1（子系统 1 + 子系统 3）+ §3（Runtime Protocol & Schemas）
- 派单依据：[`docs/agents/tasks/TASK-20260509-002-PM-to-DEV.md`](../../docs/agents/tasks/TASK-20260509-002-PM-to-DEV.md)
- Sprint 路线图：[`docs/design/codeflow-v2-on-fcop-sdk.md` §10.2](../../docs/design/codeflow-v2-on-fcop-sdk.md)

## 包内职责（v0.1）

| 子系统 | 文件 | OS 类比 | 状态 |
|---|---|---|---|
| **Agent Registry** | `src/registry/AgentRegistry.ts` | 进程控制块表 (PCB) | 接口签名 + JSDoc 完成；method body throw not-implemented |
| **Session Manager** | `src/session/SessionManager.ts` | 进程调度器（会话层） | 同上 |

## 不在本包内（按 §0.7 + §10.2 sprint 边界）

| 子系统 | 在哪个 sprint 落 |
|---|---|
| Task Scheduler (chokidar inbox 门铃) | **S3** —— 单独的 `@codeflow/scheduler` 包 |
| Skill Runtime (per-role MCP 注入) | **S5** —— 单独的 `@codeflow/skill-runtime` 包 |
| Review Engine ⭐ | **S4** —— 单独的 `@codeflow/review-engine` 包 |
| State Store (持久化) | 跨 sprint，在各包内分别实现 |
| Mobile Console / 中继 | **v0.2 S7-S10** |
| 实际调用 `Agent.create / resume` | **S3 起** —— spike 已在 [`_ignore/spike_sdk_doorbell/`](../../_ignore/spike_sdk_doorbell/) 验证 |

## 协议依赖纪律

- 本包**只消费**`@codeflow/protocol`（FCoP spec 的 TS 镜像）的类型与 schema
- **不允许**在 `src/types/state.ts` 创造任何 schema 字段；只允许 *runtime 私有* 的纯运行时构造（如 `RuntimeEvent`、`SessionHandle` 句柄等）
- 任何 schema 缺口 → 写到 [`REPORT-20260509-002-DEV-to-PM.md`](../../docs/agents/tasks/) 的「待 D:\FCoP 评审字段清单」节，**不在本包内私自加**
- 详见设计文档 §8.0 硬规则 #4 + §3.3.1.b 唯一合法升级路径

## 目录结构

```
packages/codeflow-runtime/
├── package.json
├── tsconfig.json
├── README.md                    ← 本文件
├── src/
│   ├── index.ts                 公开 API barrel
│   ├── registry/                Agent Registry（§2.1 子系统 3）
│   │   ├── AgentRegistry.ts     接口签名（6 方法，throw not-implemented）
│   │   ├── PersistentStore.ts   agents.json 持久化契约（interface only）
│   │   └── index.ts
│   ├── session/                 Session Manager（§2.1 子系统 1）
│   │   ├── SessionManager.ts    接口签名（6 方法，throw not-implemented）
│   │   ├── RunHandle.ts         单 run 句柄抽象
│   │   └── index.ts
│   └── types/
│       └── state.ts             AgentRecord / SessionRecord / RuntimeEvent
├── fixtures/                    样例数据（用于设计 review，不是测试 fixture）
│   ├── agents.json              §2.1 子系统 3 的 agents.json 样例
│   └── sessions/
│       └── valid-runtime-session-001.json
└── docs/
    └── crash-recovery.md        4 个崩溃恢复设计决策
```

## 验收（按 TASK-20260509-002 验收标准）

| 项 | 验证方式 |
|---|---|
| 包结构齐全 | 看上方目录结构 |
| 所有方法签名通过 `tsc --noEmit` | `pnpm --filter @codeflow/runtime typecheck` 零报错 |
| 方法 JSDoc 完整 | 每个 method 至少含：用途 / 入参 / 返回 / 关键不变量 / 异常 |
| 类型从 `@codeflow/protocol` 派生 | grep 不到对 `Agent` / `Session` / `Review` / `Task` / `Skill` 字段名的重新声明 |
| `crash-recovery.md` 4 问答完整 | 每问 ≥ 30 行论证 + 1 个明确推荐方案 |

## v0.1 起未来 sprint 路径

- **S3**（下一刀）：实现 `AgentRegistry.register/resume/list/get` 的真实逻辑（atomic agents.json + SDK call）
- **S4**：实现 `SessionManager.startSession/cancelSession` 的真实逻辑（含 Review Engine 联动）
- **S5**：加 `mountSkill` / `validateKernelDeps`（fcop 强依赖校验）
- **S6**：E2E 跑通 §0.8.3 Hello World demo

详见 [`docs/design/codeflow-v2-on-fcop-sdk.md` §10.2](../../docs/design/codeflow-v2-on-fcop-sdk.md)。
