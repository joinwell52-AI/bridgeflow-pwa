---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-009
sender: DEV
recipient: PM
priority: P0
thread_key: codeflow-v2-sprint-s3-phase-a-agent-registry-implementation
references:
  - TASK-20260509-009-PM-to-DEV
  - REPORT-20260509-002-DEV-to-PM
  - packages/codeflow-runtime/docs/crash-recovery.md
  - docs/design/codeflow-v2-on-fcop-sdk.md#10.2
layer: worker
---

# Sprint S3 Phase A 完成报告 — AgentRegistry + PersistentStore + RuntimeBootstrap

## 一句话结论

按 TASK-009 的 7 项必交付 + 7 条不做清单 + 11 项验收标准，Phase A 全部交齐。**16 个单元测试全过**（其中 11 个对应任务要求的 11 场景，5 个是 PersistentStore 的 sanity check）。期间发现 **0 个新的 schema 缺口**——`@codeflow/protocol` 已写好的字段足够 Phase A 使用，没有给 D:\FCoP 上游要新字段的诉求。**0 个**待 SDK 升级项——`@cursor/sdk@1.0.12` 现有 API 完全够用。

实际工时 **~3.5 小时**（预算 6-10h），未触发 1.5x 求救阈值。

## 二、影响范围

### 修改的文件（8）

| 文件 | 改动 | 说明 |
|---|---|---|
| `packages/codeflow-runtime/package.json` | 修改 | bump version `0.1.0-alpha.0` → `0.1.0-alpha.1`；加 `@cursor/sdk@^1.0.12` dep；加 `tsx@^4.21.0` devDep；加 `npm test` script |
| `packages/codeflow-runtime/package-lock.json` | 修改 | `npm install` 自动更新（136 packages added） |
| `packages/codeflow-runtime/README.md` | 重写 | 第一句改成「Phase A 已实现 …」；Phase A 完成态状态表 + 6 方法 method-by-method 表 |
| `packages/codeflow-runtime/src/index.ts` | 修改 | 增加 11 个新导出（registry 类 + errors + reconciliation 类型） |
| `packages/codeflow-runtime/src/types/state.ts` | 增量 | 加 `ReconciliationStrategy` enum + `ReconciliationReport` 等 6 个新接口；`IsoDateTime` 加入 import 列表（必交付 4） |
| `packages/codeflow-runtime/src/registry/AgentRegistry.ts` | 重写 | 6 方法 method body（去掉 `throw [S2 skeleton]`）；race-defense `_isBootstrapping` 标志（必交付 2） |
| `packages/codeflow-runtime/src/registry/PersistentStore.ts` | 重写 | 接口加 `upsert / removeById`（替换原 `upsertOne`，无外部消费者）；新增 `JsonFileStore` 类（atomic-write + fsync per write，必交付 1） |
| `packages/codeflow-runtime/src/registry/index.ts` | 修改 | 重新组织导出 |

### 新增的文件（7）

| 文件 | 说明 |
|---|---|
| `packages/codeflow-runtime/src/registry/RuntimeBootstrap.ts` | reconciliation 同步流程；处理决策 3 三场景（必交付 3） |
| `packages/codeflow-runtime/src/registry/AgentSdkAdapter.ts` | SDK 适配层接口 + `CursorSdkAdapter`（真实 `@cursor/sdk`）+ `InMemorySdkAdapter`（测试用）+ `InMemorySdkPlantedError`（必交付 5） |
| `packages/codeflow-runtime/src/registry/errors.ts` | 6 个 named error class（`ValidationError` / `LayerViolationError` / `AgentNotFoundError` / `RegistryWriteError` / `RuntimeBootstrapError` / `RuntimeNotReadyError`）|
| `packages/codeflow-runtime/src/registry/__tests__/helpers.ts` | 测试工具：`withTempStore` / `validAgentSpec` / `captureLogger` |
| `packages/codeflow-runtime/src/registry/__tests__/AgentRegistry.test.ts` | 6 个测试（场景 1-6） |
| `packages/codeflow-runtime/src/registry/__tests__/RuntimeBootstrap.test.ts` | 4 个测试（场景 7-9 + 11） |
| `packages/codeflow-runtime/src/registry/__tests__/PersistentStore.test.ts` | 6 个测试（场景 10 + 5 sanity） |

**未触碰**（按不做清单）：
- ❌ `_ignore/spike_sdk_doorbell/`（git diff stat = 0）— 保留作 spike 历史证据；`CursorSdkAdapter` 是从 sender.ts/inspect.ts 的调用模式**重写**而非 git mv 过来的
- ❌ `packages/codeflow-protocol/`（git diff stat = 0）— 协议层 0 改动
- ❌ `packages/codeflow-runtime/src/session/`（SessionManager / RunHandle 仍是 S2 骨架，等 Phase B）
- ❌ `packages/codeflow-runtime/fixtures/agents.json`（保持原 3 条设计 review 样例不变；测试用 `os.tmpdir()` 隔离）

### 是否影响已有功能

- `@codeflow/protocol` 包：`npm test` 仍 8/8 通过（5 valid + 3 invalid fixtures），未受影响
- `_ignore/spike_sdk_doorbell/` spike：未触碰
- `codeflow-desktop/` / `codeflow-plugin/` / `web/pwa/` / `server/relay/`：一行未动

### 是否需要重启服务

**不需要**——Phase A 仍是工程内交付物，无 daemon、无服务、无生产部署。

## 三、自测结果（11 项验收标准逐项确认）

| # | 验收项 | 命令 / 验证方式 | 实测结果 | 通过？|
|---|---|---|---|---|
| 1 | 包编译通过 | `cd packages/codeflow-runtime && npx tsc --noEmit` | exit 0，无任何报错 | ✅ |
| 2 | `@codeflow/protocol` 包未受影响 | `cd packages/codeflow-protocol && npm test` | 8/8 PASS（5 valid + 3 invalid 全部如预期） | ✅ |
| 3 | 单元测试 11 场景全过 | `cd packages/codeflow-runtime && npm test` | 16 tests → 16 pass / 0 fail（含 11 场景 + 5 sanity） | ✅ |
| 4 | atomic-write 模式正确 | grep `PersistentStore.ts` 找 `_tmpPath` / `fs.rename` / `sync()` 三步 | 命中：第 122 行 tmpPath 构造 / 171 行 writeFile + 173 行 sync / 188 行 rename / 204 行父目录 sync | ✅ |
| 5 | layer=admin 拒绝在 SDK 调用前完成 | 测试场景 3 spy 验证 | `AgentRegistry.test.ts:104-106` `assert.equal(sdk.calls.create.length, 0)` 命中 | ✅ |
| 6 | RuntimeNotReady 防御 | 测试场景 11 | `RuntimeBootstrap.test.ts:143` `assert.rejects(... RuntimeNotReadyError)` 命中 | ✅ |
| 7 | 协议依赖纪律 grep | 在 runtime/src 内查 `interface (Agent\|Task\|Review\|Skill\|Session)` 重新声明 | 0 命中（仅在 `import type ... from "@codeflow/protocol"` 上下文出现） | ✅ |
| 8 | ReadLints 零错误 | 对所有 14 个改动 / 新增文件跑 | 0 错误 | ✅ |
| 9 | README 更新到 Phase A 完成态 | `Get-Content README.md -TotalCount 3` | 第 3 行起：「Phase A（Sprint S3 第一阶段）已实现 AgentRegistry + PersistentStore + RuntimeBootstrap…」 | ✅ |
| 10 | 不动 spike 文件夹 | `git diff --stat _ignore/spike_sdk_doorbell/` | exit 0，无输出（diff 空） | ✅ |
| 11 | 不动 `@codeflow/protocol` 包内 schema 字段 | `git diff --stat packages/codeflow-protocol/schemas/ packages/codeflow-protocol/src/types.ts` | exit 0，无输出（diff 空） | ✅ |

### `npm test` 完整输出（16/16）

```
✔ register: normal flow persists record + sets sdk_agent_id (59.481ms)
✔ register: schema validation rejects missing layer (3.5657ms)
✔ register: layer=admin throws LayerViolationError before SDK is touched (2.4685ms)
✔ register: SDK create throws → agents.json is not written (2.1544ms)
✔ resume: SDK knows the id → record's reconciled_at is updated (49.2074ms)
✔ resume: agent not in store → AgentNotFoundError (5.2151ms)
✔ loadAll returns [] when agents.json doesn't exist (6.2281ms)
✔ saveAll then loadAll round-trips records (22.0262ms)
✔ upsert adds new record then replaces it on second call (59.7853ms)
✔ removeById deletes existing, no-ops missing (46.9827ms)
✔ loadAll throws RegistryWriteError on corrupt JSON (6.7462ms)
✔ scenario 10: rename failure → original agents.json preserved, .tmp visible (48.729ms)
✔ bootstrap: 2 known records → report.success.length === 2 (108.2373ms)
✔ bootstrap: record's sdk_agent_id absent from SDK → orphan_local (33.3857ms)
✔ bootstrap: SDK exposes a foreign id → report.foreign + agents.json unchanged (32.3287ms)
✔ bootstrap: register during run() throws RuntimeNotReadyError (32.2794ms)
ℹ tests 16    ℹ pass 16    ℹ fail 0
```

## 四、关键决策记录（实现期间的工程判断）

按任务 §回执要求 #4：crash-recovery.md 没覆盖到的工程判断，单独列出供 PM/ADMIN 复议。

### 决策 A — Phase A 7 个 named error class

任务说"所有错误用 named class（`ValidationError` / `LayerViolationError` / `AgentNotFoundError` / `RegistryWriteError` 等）"。我落地了 **6 个**（去掉 "等"，确定下来）：

1. `ValidationError`（schema 验证失败，含 ajv `errors[]`）
2. `LayerViolationError`（layer=admin 试图 register）
3. `AgentNotFoundError`（resume / updateRuntimeBinding / markFailed 找不到）
4. `RegistryWriteError`（PersistentStore 写失败）
5. `RuntimeBootstrapError`（agents.json 解析失败 HARD FAIL）
6. `RuntimeNotReadyError`（race-defense）

每个都加了完整 JSDoc 解释**何时用 / 测试如何 assert / 与 crash-recovery.md 决策的对应**。理由：tests 用 `assert.rejects(fn, ErrorClass)` 是最稳定的 assertion handle（消息字符串会随时间漂移），分类清楚后 Mobile push / 审计日志 / stdout 只需 `instanceof` 路由文案。

### 决策 B — `PersistentStore.upsert` / `removeById` 替换 `upsertOne`

原 S2 接口的 `upsertOne(record)` 与 task 9 §必交付 1 写的 `upsert(record) / removeById(agentId)` 命名冲突。

排查：grep 确认 `upsertOne` 只在 PersistentStore.ts 自引用，无外部消费者。**直接重命名**为 `upsert`，并新增 `removeById`（任务规范）。这是单仓 monorepo + 私有 unstable API 阶段的合理选择，避免留 alias 噪音。

### 决策 C — `updateRuntimeBinding` Phase A 不自动触发 resume

任务文字描述："`updateRuntimeBinding(agentId, runtime)` (a) get record；(b) 如 record.runtime === runtime 则 no-op；(c) 否则更新字段 + `_store.upsert` —— **不在本任务自动触发 resume**（避免副作用串联，留给上层显式 call resume）"。

实现严格按这个写法。**注意旧 JSDoc**（S2 时代）说"Triggers an automatic `resume` on the new node"——这条 JSDoc 我已修订，现 JSDoc 明确写"Phase A behavior: ONLY updates the persisted binding mode. It does NOT call `resume`"，把行为契约对齐 task 9。

### 决策 D — `RuntimeBootstrap` 不直接调用 `registry.resume`

任务的 reconciliation ASCII 写"调 SDK.resume(sdk_agent_id)"——我让 RuntimeBootstrap 调 **`AgentSdkAdapter.resume(sdkAgentId)`** 而**不是** `AgentRegistry.resume(agentId)`。理由：

- `AgentRegistry.resume` 内部也会调 SDK + 写 store；如果 RuntimeBootstrap 经 registry 调，会出现 "registry.resume 内部还要再 loadAll 找 record" 的多余读 + 双重 store 写。
- 更重要：bootstrap 期间 `_isBootstrapping=true`，registry 公开 method 不该被自己内部调用（race-defense 语义错位）。

最终路径：bootstrap 直接调 `_sdk.resume(sdkAgentId)`，成功 → 直接 `_store.upsert(updated)` 更新 `runtime_last_reconciled_at`；失败 → 调 `registry.markFailed`（这是合法的 internal API，且 markFailed 不被 race-defense 拦）。

`registry.resume`（公开 API）保留给 *崩溃后用户 / 调用方* 触发重新绑定时使用。

### 决策 E — 测试框架 `node:test + tsx`

任务允许 `node:test`（Node 20+ 内置）或 `vitest`，"不要新引入 jest / mocha"。

我选 `node --import tsx --test src/registry/__tests__/*.test.ts`：
- `node:test` 是内置，零额外测试框架依赖
- `tsx` 是 TS loader（不是测试框架），spike 包已用过，延续既有约定
- `--import tsx` 是 Node 20.6+ 的新语法（替代 `--loader`），tsx 文档推荐
- 跑 16 测试约 2.4 秒，毫无性能问题

`tsx` 加进 `devDependencies`（不污染 production deps）。

### 决策 F — `agents.json` 默认路径 `.codeflow/state/agents.json`

任务 §不做：「把 `agents.json` 路径硬编码——必须可配置（默认 `.codeflow/state/agents.json`，PersistentStore 构造时注入）」。

实现：`JsonFileStore` 构造函数 `opts: { path: string }`——**必填**字段，没有默认。理由：让 caller 在 composition root 显式声明路径，防止"运行时跑错地方"的隐蔽 bug。

测试全部用 `os.tmpdir()` rooted 的临时路径；production 调用方应传 `path.join(process.cwd(), ".codeflow/state/agents.json")`。README + JSDoc 都明确写了这个约定。

### 决策 G — atomic-write 步骤 4（父目录 fsync）跨平台兼容

`crash-recovery.md` 决策 1 + task §必交付 1 都要求 `fs.fsync(parent_dir_fd)`。

**Windows 上 `fs.open(<directory>, 'r')` 会失败**（NTFS 不支持 dir handle）。我加了 `process.platform !== 'win32'` 守护：Linux/macOS 走父目录 fsync，Windows 跳过（NTFS rename 已经走 journal，事实上 durable）。失败也只是 `console.warn` 不抛——任务的"step 4 失败 → 不阻断 saveAll"语义。

## 五、待 D:\FCoP 评审字段清单 ⭐

**0 个。**

理由：Phase A 实现期间，所有 runtime 需求都用 `@codeflow/protocol` 已有字段表达。具体复盘：

| Runtime 需求 | 用了 §3 哪个字段 | 是否新加？|
|---|---|---|
| Agent layer 校验（admin reject） | `Agent.layer === "admin"`（已有 enum） | 无新加 |
| crash 后 SDK 接管 | `Agent.sdk_agent_id` | 无新加 |
| ajv schema 校验入参 | `loadSchema("agent")` + `validate(...)` | 无新加（来自 protocol package） |
| 标 failed 状态 | `Agent.status = "error"` | 无新加 |
| 更新最后活跃时间 | `Agent.last_active_at` | 无新加 |
| 区分 sdk_agent_id 是否被 SDK 认知 | runtime 私有 `ReconciliationStrategy` enum | runtime-only（state.ts），**不入 protocol** |
| 启动 reconciliation 报告 | runtime 私有 `ReconciliationReport` | runtime-only（state.ts），**不入 protocol** |

**关键合规检查**：所有 runtime-only 类型（`ReconciliationReport` / `ReconciliationStrategy` / `RuntimeFailure` / `RuntimeBindingMode`）都放在 `src/types/state.ts` 内、用 `runtime_` 前缀或独立类型，与 schema 字段在视觉上完全分离。任何 reviewer 一眼能看出"这是 runtime 私有的，不该被 D:\FCoP 接受"。

## 六、待 SDK 升级清单 ⭐

**0 个。**

`@cursor/sdk@1.0.12` 现有 API 完全够用：

| Phase A 需要 | SDK 提供 |
|---|---|
| 创建 SDK agent | `Agent.create(opts)` → `SDKAgent` (`agentId` 可读) ✅ |
| 列出 SDK agents | `Agent.list({ runtime?, cwd? })` → `ListResult<SDKAgentInfo>` (`items[].agentId`) ✅ |
| 重新接管 | `Agent.resume(agentId, opts?)` → `SDKAgent` ✅ |
| 释放 | `agent[Symbol.asyncDispose]()` ✅ |
| 错误类 | `CursorAgentError` 已可 instanceof ✅ |

**未来 Phase B 可能需要**（提前预告，不在本回执范围）：
- `agent.send(...)` → `Run`：用于 SessionManager.startSession（SDK 已提供，复用 spike 的 sender.ts 模式即可）
- `run.cancel()` / `run.stream()` / `run.wait()`：用于 SessionManager.cancelSession + transcript writer（SDK 已提供）

## 七、不做清单（7 条）对账

| 不做项 | 实际是否触碰 |
|---|---|
| ❌ 任何 SessionManager / SessionStore / TranscriptWriter 实现 | ✅ 严守——`src/session/` 一行未动 |
| ❌ Task Scheduler chokidar inbox 门铃 | ✅ 严守——本仓没引入 chokidar 依赖 |
| ❌ Skill Runtime / Review Engine | ✅ 严守 |
| ❌ 在 `@codeflow/protocol` 之外新创造 schema 字段 | ✅ 严守——见 §五 |
| ❌ 任何 Mobile push / WebSocket / 中继代码 | ✅ 严守 |
| ❌ 修改 `_ignore/spike_sdk_doorbell/` | ✅ 严守——`git diff` 空（验收 #10） |
| ❌ 升级 `@cursor/sdk` 版本 | ✅ 严守——保持 `^1.0.12` |
| ❌ 把 `agents.json` 路径硬编码 | ✅ 严守——见决策 F |

## 八、给 PM 的下一步建议

### 立刻可启动（待 PM/ADMIN review 通过本 REPORT）

- **Phase B：SessionManager 真实实现** — Phase A 已为 Phase B 准备好的接口：
  - `AgentRegistry.get(agentId)` / `AgentRegistry.list({ status: "running" })` 可被 SessionManager 用来解析 agent
  - `AgentSdkAdapter` 可扩展加 `send(sdkAgentId, payload) → Run` 方法（不破坏 Phase A 调用方）
  - `state.ts` 的 `RuntimeEvent` / `SessionRecord` 类型已为 Phase B 准备就绪
  - 决策 4（SessionStore 元数据 JSON + transcript markdown 拆分）可直接落地

### 与 Phase B 无依赖、可并行

- **QA 已交 `REPORT-20260509-010-QA-to-PM.md` + `test-strategy-s3.md`**（git status 看到，还未读）— PM 应交叉审计 QA 测策与 Phase A 实测的覆盖度差异，必要时回 QA 补 Phase A 没覆盖的边界用例
- **OPS 已交 `REPORT-20260509-011-OPS-to-PM.md`**（git status 看到，还未读）— commit-bundle 状态待 PM 确认

### 风险与未决项

| 项 | 状态 | 责任方 |
|---|---|---|
| Phase A 设计 review | pending | PM/ADMIN（可以读本回执 + 跑 `npm test` 看 16/16 PASS 直接拍板）|
| Phase B 启动信号 | pending | PM/ADMIN |
| 决策 D（bootstrap 不走 registry.resume）是否需要写进 crash-recovery.md 作为延伸条款 | pending | PM 自行决定是否值得一改 |
| `@codeflow/runtime` v1.0 是否 export `_setBootstrapping`（目前下划线前缀 + JSDoc `@internal`，但仍 public TS 可见） | pending | 与 v1.0 schema freeze 一并决策 |

### S3 进展

- ✅ Phase A（本回执）：AgentRegistry + PersistentStore + RuntimeBootstrap
- ⏸ Phase B：SessionManager + SessionStore + TranscriptWriter（决策 4 兑现）
- ⏸ Phase C：Task Scheduler chokidar inbox 门铃 + state_history 自动追加 + E2E mini demo

预计剩余 S3 工作量约 1.5-2 天（Phase B ~6h + Phase C ~6h + buffer）。

---

DEV-01 待命。Phase A 全部交付物已就位 + 16/16 测试 PASS + 11/11 验收 PASS，等 PM/ADMIN review 后决定是否启动 Phase B。
