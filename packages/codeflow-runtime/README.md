# @codeflow/runtime

> **Phase A + Phase B + Phase C（Sprint S3）已完成 — AgentRegistry + PersistentStore + RuntimeBootstrap + SessionManager + SessionStore + TranscriptWriter + InboxWatcher + TaskParser + StateHistoryWriter + TaskDispatcher + Runtime 顶层装配 全部 v0.1 兑现。Skill Runtime / Review Engine 见路线图 S4 / S5。**

CodeFlow AI Runtime —— 6 大 kernel 子系统中的 **3 个**（Agent Registry + Session Manager + Task Scheduler），现已 v0.1 全量落地。

- 上游设计：[`docs/design/codeflow-v2-on-fcop-sdk.md`](../../docs/design/codeflow-v2-on-fcop-sdk.md) §2.1（子系统 1 + 子系统 3）+ §2.4（Inbox watcher）+ §3（Runtime Protocol & Schemas）
- Phase A 派单：[`docs/agents/tasks/TASK-20260509-009-PM-to-DEV.md`](../../docs/agents/tasks/TASK-20260509-009-PM-to-DEV.md)
- Phase B 派单：[`docs/agents/tasks/TASK-20260509-013-PM-to-DEV.md`](../../docs/agents/tasks/TASK-20260509-013-PM-to-DEV.md)
- Phase C 派单：[`docs/agents/tasks/TASK-20260509-018-PM-to-DEV.md`](../../docs/agents/tasks/TASK-20260509-018-PM-to-DEV.md)
- Sprint 路线图：[`docs/design/codeflow-v2-on-fcop-sdk.md` §10.2](../../docs/design/codeflow-v2-on-fcop-sdk.md)
- 持久化决策：[`docs/crash-recovery.md`](./docs/crash-recovery.md)

## 包内职责（v0.1 全量）

| 子系统 / 类 | 文件 | OS 类比 | 状态 |
|---|---|---|---|
| **AgentRegistry** | `src/registry/AgentRegistry.ts` | 进程控制块表 (PCB) | ✅ Phase A 完成（6 方法 + race-defense） |
| **PersistentStore** + `JsonFileStore` | `src/registry/PersistentStore.ts` | 文件系统 + journal log | ✅ Phase A 完成（atomic-write + fsync） |
| **RuntimeBootstrap** | `src/registry/RuntimeBootstrap.ts` | init / systemd | ✅ Phase A 完成（reconciliation 同步流程 + TS-2.8 SDK.list HARD FAIL） |
| **AgentSdkAdapter** + `CursorSdkAdapter` / `InMemorySdkAdapter` | `src/registry/AgentSdkAdapter.ts` | SDK 适配层 | ✅ Phase A + Phase B 完成（含 send 接口） |
| **SessionManager** | `src/session/SessionManager.ts` | 进程调度器（会话层） | ✅ Phase B 完成（6 方法 + emergency stop） |
| **SessionStore** | `src/session/SessionStore.ts` | 单 record per file 的 PCB 存储 | ✅ Phase B 完成（atomic-write 复用 helper） |
| **TranscriptWriter** | `src/session/TranscriptWriter.ts` | 事件流 append-only md | ✅ Phase B 完成（streaming + concurrent-close safe） |
| **SdkRunHandle** | `src/session/SdkRunHandle.ts` | SDK Run 包装 + 8→`sdk.*` 事件映射 | ✅ Phase B 完成 |
| **InboxWatcher** | `src/scheduler/InboxWatcher.ts` | 进程事件投递 doorbell | ✅ Phase C 完成（chokidar depth=0 + 严格 regex + handler 隔离） |
| **TaskParser** | `src/scheduler/TaskParser.ts` | 进程描述符解析器 | ✅ Phase C 完成（yaml@^2 + 容忍无 frontmatter / 半成品） |
| **StateHistoryWriter** | `src/scheduler/StateHistoryWriter.ts` | 进程审计日志（append-only） | ✅ Phase C 完成（markdown body 追加；不动 schema-约束的 frontmatter 数组） |
| **TaskDispatcher** | `src/scheduler/TaskDispatcher.ts` | 调度器 dispatch 链路 | ✅ Phase C 完成（4 步 dispatch + reject_busy + settle 钩子） |
| **Runtime** | `src/Runtime.ts` | 顶层 composition root | ✅ Phase C 完成（8 子系统装配；E2E demo + S6 codeflow-shell 共用入口） |
| `ReconciliationReport` / `ReconciliationStrategy` | `src/types/state.ts` | 启动审计 | ✅ Phase A 完成（drift 检测留位 Phase B+） |

### AgentRegistry 6 方法 method-by-method

| 方法 | 状态 | 关键不变量 |
|---|---|---|
| `register(spec)` | ✅ 完成 | layer=admin 在 SDK 调用前 reject；ajv 验证；SDK 失败 → agents.json 不写 |
| `resume(agentId)` | ✅ 完成 | 找不到 → `AgentNotFoundError`；SDK 失败保留原 cause；更新 `runtime_last_reconciled_at` |
| `list(filter?)` | ✅ 完成 | layer / role / status 三字段 AND-combined |
| `get(agentId)` | ✅ 完成 | 不存在返 `null`，不抛 |
| `updateRuntimeBinding(agentId, runtime)` | ✅ 完成 | 不自动触发 resume（避免副作用串联） |
| `markFailed(agentId, error)` | ✅ 完成 | 写 `status=error` + `runtime_failure` |

### SessionManager 6 方法 method-by-method（Phase B 新增）

| 方法 | 状态 | 关键不变量 |
|---|---|---|
| `startSession(agentId, taskId, payload)` | ✅ 完成 | agent 验证先于 SDK 调用；attach 早于 save 防 event race；save 失败 → SDK 反向 cancel + 状态回滚 |
| `getSession(sessionId)` | ✅ 完成 | 不存在返 `null`，不抛（与 `AgentRegistry.get` 对称） |
| `listActive()` | ✅ 完成 | 直接 SessionStore 反映；无内存缓存防止跨重启漂移 |
| `cancelSession(sessionId, reason)` | ✅ 完成 | **SDK cancel 严格先于持久化**；幂等（二次取消 → transcript warning） |
| `cancelAllForEmergencyStop()` | ✅ 完成 | `Promise.allSettled` 语义，单失败不阻塞同伴；EMERGENCY-{ts}.md 留 v0.2 S10 钩子 |
| `onEvent(handler)` | ✅ 完成 | 12 类 RuntimeEvent fan-out；throw listener 自动 unsubscribe + console.error |

### TaskDispatcher dispatch 4 步流水线（Phase C 新增）

| 步骤 | 失败时落档 | 关键不变量 |
|---|---|---|
| **1. 解析 task.md**（`TaskParser`） | `state_history: inbox → parse_failed`（含 reason） | YAML 解析失败 = `TaskParseError`；无 frontmatter 不算失败 |
| **2. 找 recipient agent**（`AgentRegistry.list({ role })`） | `state_history: inbox → agent_not_found`（含 recipient） | frontmatter.recipient 优先；fallback filename `-to-XXX` 段 |
| **3. `SessionManager.startSession`** | `state_history: inbox → rejected_busy / start_failed` | `InvalidAgentStatusError` 触发 reject_busy；queue 是 v0.2 |
| **4. 监听 `runtime.session_ended` / `_cancelled`** | `state_history: dispatched → ended / cancelled`（含 status / reason） | filter `session_id` 命中后 unsubscribe；防内存泄漏 |

### Phase B + C 关键设计决策（实施时锁定）

- **决策 J**（Phase B）：`SessionNotFoundError` / `InvalidAgentStatusError` 合并到 `registry/errors.ts`，不另起 `session-errors.ts`。Phase C 沿用 → `TaskParseError` / `TaskFileNotFoundError` 也合并入同一文件
- **决策 M**（Phase B）：`RuntimeEventType` 8 个 sdk.* 类型以 `_ignore/spike_sdk_doorbell/` 实测为准（system / thinking / assistant / tool_call / status / task / request / user）
- **决策 N**（Phase B）：每次 `send` 内部走 `Agent.resume → agent.send → 包装成 RunHandle → settled 时 dispose`，不在 adapter 内持池
- **决策 A**（Phase C ⚠️）：StateHistoryWriter **不**改 frontmatter `state_history` 数组，只在 markdown body 末尾追加 `## state_history (auto-appended by runtime)` 段落。原因：`task.schema.json` line 47-60 把 `state_history.items` 锁为 `{state, at, by}` 且 `additionalProperties: false`，runtime 想记录的 `{at, by, from, to, note}` 不兼容；markdown body 不在 schema 约束范围
- **决策 B**（Phase C）：Phase C 默认 reject_busy，不实现 task queue；ADMIN 后续可手动 cancel 老 session 后再 dispatch 新 task。Queue 是 v0.2 范围

## 不在本包内（按 §0.7 + §10.2 sprint 边界）

| 子系统 | 在哪个 sprint 落 |
|---|---|
| Skill Runtime (per-role MCP 注入) | **S5** —— 单独的 `@codeflow/skill-runtime` 包 |
| Review Engine ⭐ | **S4** —— 单独的 `@codeflow/review-engine` 包 |
| codeflow-shell EXE 壳子 | **S6** —— Node SEA bundle，import `Runtime.create` 即用 |
| Mobile Console / 中继 | **v0.2 S7-S10** |
| Task queue（同 agent 已 running 时排队） | **v0.2** —— 当前默认 reject_busy |
| `inbox/<role>/` 子目录路由 | **v0.x+** —— 当前 `docs/agents/tasks/` 平铺，与 §2.4 reference impl 不同 |
| EMERGENCY-{ts}.md 落档（emergency stop 完整审计） | **v0.2 S10**（接钩子） |
| 实际调用 `Agent.create / resume` 的 spike | 仍在 [`_ignore/spike_sdk_doorbell/`](../../_ignore/spike_sdk_doorbell/) — 作为参考实现保留 |

## 协议依赖纪律（Phase A + B + C 一致）

- 本包**只消费**`@codeflow/protocol`（FCoP spec 的 TS 镜像）的类型与 schema
- **不允许**在 `src/types/state.ts` 创造任何 schema 字段；只允许 *runtime 私有* 的纯运行时构造（如 `RuntimeEvent` / `ReconciliationReport` / `SessionHandle` / `RunHandle` / `ParsedTask` / `StateHistoryEntry` 等）
- 任何 schema 缺口 → 写到 PM 的回执，**不在本包内私自加**
- Phase A + Phase B + Phase C 实施过程中 **0 个** schema 缺口出现（详见 §决策 A — runtime `StateHistoryEntry` 严格隔离 frontmatter `state_history` 数组）
- 详见设计文档 §8.0 硬规则 #4 + §3.3.1.b 唯一合法升级路径

## 目录结构

```
packages/codeflow-runtime/
├── package.json                               (含 chokidar^4 + yaml^2)
├── tsconfig.json
├── README.md                                  ← 本文件
├── examples/
│   └── hello-world.ts                         ✅ Phase C E2E demo（用 InMemorySdkAdapter）
├── src/
│   ├── index.ts                               公开 API barrel（含 Runtime + scheduler）
│   ├── Runtime.ts                             ✅ Phase C 顶层装配 root（8 子系统）
│   ├── _internal/
│   │   └── atomic-write.ts                    ✅ Phase B 抽取的 atomicWriteJson helper
│   ├── registry/                              Agent Registry（§2.1 子系统 3）
│   │   ├── AgentRegistry.ts                   ✅ Phase A 完成
│   │   ├── PersistentStore.ts                 ✅ JsonFileStore (atomic-write+fsync)
│   │   ├── RuntimeBootstrap.ts                ✅ Phase A + TS-2.8 SDK.list HARD FAIL
│   │   ├── AgentSdkAdapter.ts                 ✅ + send + InMemoryRunHandle (Phase B)
│   │   ├── errors.ts                          ✅ 10 个 named error class（Phase A 6 + Phase B 2 + Phase C 2）
│   │   ├── index.ts
│   │   └── __tests__/                         18 个 node:test，全部通过
│   │       ├── AgentRegistry.test.ts          场景 1-6
│   │       ├── RuntimeBootstrap.test.ts       场景 7-9 + 11 + 12 (TS-2.8 B-path)
│   │       ├── PersistentStore.test.ts        场景 10 + 11 (并发 upsert TS-1.6) + 5 sanity
│   │       └── helpers.ts
│   ├── session/                               Session Manager（§2.1 子系统 1）
│   │   ├── SessionManager.ts                  ✅ Phase B 完成（6 方法）
│   │   ├── SessionStore.ts                    ✅ Phase B 完成（单 record per file）
│   │   ├── TranscriptWriter.ts                ✅ Phase B 完成（append-only md + 并发 close 安全）
│   │   ├── SdkRunHandle.ts                    ✅ Phase B 完成（SDK Run 包装 + 8→sdk.* 映射）
│   │   ├── index.ts
│   │   └── __tests__/                         22 个 node:test，全部通过
│   │       ├── SessionManager.test.ts         TS-4.1 ~ TS-4.5 + onEvent 隔离
│   │       ├── SessionStore.test.ts           save/load/listAll/remove + tolerant-read
│   │       ├── TranscriptWriter.test.ts       attach/append/close/closeAll
│   │       └── helpers.ts
│   ├── scheduler/                             Task Scheduler（§2.4 inbox watcher）
│   │   ├── InboxWatcher.ts                    ✅ Phase C 完成（chokidar4 doorbell）
│   │   ├── TaskParser.ts                      ✅ Phase C 完成（yaml@^2 + tolerant）
│   │   ├── StateHistoryWriter.ts              ✅ Phase C 完成（append-only md ⚠️ 决策 A）
│   │   ├── TaskDispatcher.ts                  ✅ Phase C 完成（4 步 dispatch + settle 钩子）
│   │   ├── index.ts
│   │   └── __tests__/                         14 个 node:test，全部通过
│   │       ├── InboxWatcher.test.ts           TS-5.1 ~ TS-5.3
│   │       ├── TaskParser.test.ts             TS-5.4 ~ TS-5.6 + bonus
│   │       ├── StateHistoryWriter.test.ts     TS-5.7 ~ TS-5.9
│   │       ├── TaskDispatcher.test.ts         TS-5.10 ~ TS-5.13（含 reject_busy 验收 #5）
│   │       └── helpers.ts
│   └── types/
│       └── state.ts                           AgentRecord / SessionRecord / RuntimeEvent
│                                              + Phase A: ReconciliationReport
│                                              + Phase B: RunHandle.onEvent + RuntimeEventType 12 类
├── fixtures/                                  样例数据（设计 review，非测试）
│   ├── agents.json                            §2.1 子系统 3 的 agents.json 样例
│   └── sessions/
│       └── valid-runtime-session-001.json
└── docs/
    ├── crash-recovery.md                      4 个崩溃恢复设计决策
    └── test-strategy-s3.md                    S3 测试策略（Phase A/B/C 测试场景对照）
```

## 验收

| 项 | 验证方式 |
|---|---|
| 包编译通过 | `npx tsc --noEmit`（零报错） |
| 单元测试 | `npm test`（**54/54** 全过 — Phase A 18 + Phase B 22 + Phase C 14） |
| `@codeflow/protocol` 包未受影响 | `cd ../codeflow-protocol && npm test`（仍 8/8 通过） |
| atomic-write 模式 | `PersistentStore.ts` + `_internal/atomic-write.ts` 含 `writeFile(*.tmp)` + `rename` + 父目录 `fsync` |
| layer=admin 拒绝在 SDK 调用前 | 测试场景 3 spy 验证 `sdk.calls.create.length === 0` |
| RuntimeNotReady 防御 | 测试场景 11 |
| TS-2.8 SDK.list HARD FAIL | 测试场景 12 |
| TS-1.6 并发 upsert 不损坏 JSON | 测试场景 11（PersistentStore） |
| SessionManager 串行不变量 | TS-4.4：`SDK cancel 时间戳 ≤ store cancelled 时间戳` |
| Phase B emergency stop allSettled | TS-4.5：1 失败 + 1 成功 = `cancelled.length + failed.length === 2` |
| InboxWatcher 严格 regex 匹配 | TS-5.2：REPORT-*.md / HANDOFF-*.md 静默忽略，0 warning |
| TaskDispatcher reject_busy | TS-5.13：同 agent status=running 时第二个 task → `state_history: inbox → rejected_busy` |
| StateHistoryWriter 写法核对 | TS-5.7/5.8：首次加标题，后续只加 bullet；frontmatter 不变 |
| 协议依赖纪律 | `src/registry`/`src/session`/`src/scheduler`/`src/types` 不重新声明 schema 字段，仅 `import type` from `@codeflow/protocol` |

## 跑测试 + Demo

```bash
cd packages/codeflow-runtime
npm install         # 一次性
npm run typecheck   # 0 错误
npm test            # 54/54 PASS

# Phase C E2E demo（无需真实 Cursor SDK，用 InMemorySdkAdapter）
npx tsx examples/hello-world.ts
# Drop a TASK-*-XXX-to-DEV.md into examples/inbox/ to trigger the pipeline.
# Ctrl+C to stop.
```

## v0.1 起未来 sprint 路径

- ✅ **Phase A**（commit `407cfa5`）：AgentRegistry + PersistentStore + RuntimeBootstrap
- ✅ **Phase B**（commit `8c49907`）：SessionManager + SessionStore + TranscriptWriter + TS-2.8 patch + L2 文档落档
- ✅ **Phase C**（本里程碑）：InboxWatcher + TaskParser + StateHistoryWriter + TaskDispatcher + Runtime 顶层装配 + E2E mini demo
- ⏸ **S4**：Review Engine（最关键⭐）
- ⏸ **S5**：Skill Runtime + fcop 强依赖校验
- ⏸ **S6**：E2E 跑通 §0.8.3 Hello World demo + v2 EXE 出厂（codeflow-shell + Node SEA）

详见 [`docs/design/codeflow-v2-on-fcop-sdk.md` §10.2](../../docs/design/codeflow-v2-on-fcop-sdk.md) + [§11 v2 Packaging](../../docs/design/codeflow-v2-on-fcop-sdk.md)。
