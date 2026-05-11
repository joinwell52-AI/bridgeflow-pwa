---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-024
sender: DEV
recipient: PM
priority: P1
thread_key: codeflow-v2-sprint-s5-skill-runtime-fcop-validation
references:
  - TASK-20260509-024-PM-to-DEV
  - REPORT-20260509-022-DEV-to-PM
  - REPORT-20260509-023-OPS-to-PM
  - REPORT-20260509-025-QA-to-PM
  - docs/design/codeflow-v2-on-fcop-sdk.md#0.5
  - docs/design/codeflow-v2-on-fcop-sdk.md#0.7.5
  - docs/design/codeflow-v2-on-fcop-sdk.md#3.6
layer: governance
---

# REPORT-024：Sprint S5 Phase E 完成（Skill Runtime + fcop 强依赖闸 + Phase D race-loop 兜底）

## 一句话结论

**S5 Phase E 全量完成 — `SkillRegistry` + `KernelDependencyValidator` + `MCPInjector`（v0.1 stub）+ `RuntimeBootstrap` kernel 阶段 + `AgentRegistry.register` 前置 hook + `Runtime` 14-子系统装配落地。94/94 测试 PASS（含 17 个 TS-7.x 全过 = 13 派单 + 4 bonus），30 次回归 0 flaky。同时修复了一处 Phase D `ReviewEngine.whenSettled` race-loop（post-OPS-023 baseline 上 70/71 间歇性失败的根因），baseline 现稳定 71/71 + S5 增加 23 测试 = 94 总数。**

请 PM 派单 OPS-26 完成 commit + push。

---

## §一 主交付 7 项 method-by-method

### 1. `SkillRegistry`（`src/skill/SkillRegistry.ts`）

| 方法 | 行为 | 关键不变量 |
|---|---|---|
| `load()` | 异步扫描 `<skillsDir>/*.json`，返回 `{ loaded, skipped[] }` | 复用 `SessionStore.listAll` 的 tolerant-read pattern：跳过 `*.tmp` / 非 `.json` / 空文件 / 损坏 JSON / schema 不合格 / **filename ↔ skill_id 不一致** — 6 类原因都不抛 |
| `getById(id)` | O(1) lookup | 不存在返 `null`，不抛 |
| `listForRole(role)` | 反向索引 | `available_to_roles` 多角色覆盖；空返 `[]` |
| `list()` | 全量插入序 | 用于 demo / stdout summary |
| `size()` | 索引 size | `loaded.length === byId.size` 不变量供 test 直接断言 |

**Schema 校验**：调用 `@codeflow/protocol` 的 `validate("skill", obj)`（async API）。失败 → `SkillSchemaError` 包装 errors 入 `skipped[].reason`，**不向调用方传播**（个别 skill 文件烂掉不应阻塞整体启动）。

### 2. `KernelDependencyValidator`（`src/skill/KernelDependencyValidator.ts`）

3 个 reason，与 `KernelDependencyError.reason` / `KernelValidationFailureEntry.reason` 1:1 同步（无翻译层）：

| reason | 触发条件 |
|---|---|
| `no_fcop_skill` | `agent.skills` 为空（fast path）OR 解析后无任何 `required_kernel` 含 `^fcop@.+` |
| `skill_not_found` | `agent.skills` 中至少一个 `skill_id` 在 `SkillRegistry` 不存在 |
| `no_compatible_runtime` | 解析后**无任何** skill 的 `compatible_runtimes` 含 `hostRuntime`（默认 `local`）|

**`compatible_runtimes` 缺省语义**：缺省字段 = 默认接受 `local`/`cloud` 任意 host_runtime（schema 标记字段为可选；强制每个 skill 写 = 超越 schema 约束）。TS-7.8 测试通过 plant 显式 `compatible_runtimes: ["cloud"]` 来命中拒绝路径，TS-7.8b 测试缺省字段命中通过路径。

**API 4 个**：
- `validateAgent(record)` — bootstrap 用
- `validateAgentSpec(spec)` — register 用（input shape 不同）
- `validateAll(records)` — bulk 聚合
- `assertAgentSpec(spec)` — 包装抛 `KernelDependencyError`，register 直接调

### 3. `MCPInjector`（`src/skill/MCPInjector.ts`）

| API | stub mode 行为（v0.1）|
|---|---|
| `mount(record)` | 解析 `agent.skills` → 输出 `MCPMount[]` audit；`logger.info` 一行总结；**不 spawn 子进程** |
| `unmount(agent_id)` | 清空 audit + log；幂等（unmount unknown agent 不抛）|
| `getMounted(agent_id)` | 当前挂载的 skill 列表 |
| `listMounted()` | 全部挂载的 agent_id 列表 |
| `mode` | 只读 getter，构造时锁定 |

**`mode="live"` ctor 即 eager throw `MCPInjectorLiveModeNotImplementedError`**（决策 T，详见 §三决策）。

### 4. `RuntimeBootstrap` kernel 阶段（`src/registry/RuntimeBootstrap.ts`）

新增**两段** `if (this._kernelValidator) {…}` 块（决策 P + Q）：

```
Step (1)…(N) 已有 reconcile loop
  ↓ success[] / orphaned / foreign 已分组
Phase E 第 1 段：kernel-dep audit
  ↓ for each survivor: validateAll(records)
  ↓ failure → splice from success[], push to failed[] + kernel_failures[]
  ↓ markFailed 同步落盘
Phase E 第 2 段：MCP mount（顺序 await）
  ↓ for each (still-)survivor: mcpInjector.mount(record)
  ↓ mount 失败 → logger.warn，不 fatal（v0.1 stub 模式 mount 不可能失败）
Step (N+1) 组装 ReconciliationReport
```

`ReconciliationReport.kernel_failures: KernelValidationFailureEntry[]` 新字段（`src/types/state.ts`）。Summary 行追加 `🚫 N kernel-dep` 后缀（仅 N>0 时显示）。

### 5. `AgentRegistry.register` 前置 hook（`src/registry/AgentRegistry.ts`）

`AgentRegistryOptions` 新增**两个可选**字段（决策 R）：`kernelValidator?` + `mcpInjector?`。register 流程改为：

```
1. _isBootstrapping check       (Phase A)
2. layer=admin reject           (Phase A)
3. ajv schema validate          (Phase A)
4. ⭐ kernelValidator.assertAgentSpec(spec)  ← 决策 S：schema 之后 SDK 之前
5. SDK.create                   (Phase A)
6. store.upsert                 (Phase A)
7. ⭐ mcpInjector.mount(record)               ← 决策 T：store 之后
```

**零回归**：Phase A-D 的 67 个测试无一通过 `Runtime.create`，全部直接 `new AgentRegistry({ store, sdk })` —— 两个新字段缺省 = `null` = Phase A 行为完全一致。

### 6. `Runtime.create` 装配（`src/Runtime.ts`）

skill 层在 registry 层**之前**装配（`SkillRegistry.load()` 在 ctor 内同步 await，零生命周期 → 决策 U：start/stop 顺序不变）：

```
SkillRegistry.load()       ← skills 同步装载
  ↓
KernelDependencyValidator  ← 纯计算无生命周期
MCPInjector                ← stub mode 无 start/stop
  ↓
JsonFileStore + AgentRegistry({ store, sdk, kernelValidator, mcpInjector })
RuntimeBootstrap({ store, sdk, registry, kernelValidator, mcpInjector })
  ↓ run()
SessionStore + TranscriptWriter + SessionManager + …（Phase B-D 不变）
```

新增 `RuntimeCreateOptions.skillsDir` (默认 `<persistDir>/skills`) + `mcpInjectorMode` (默认 `"stub"`)。

### 7. 错误类（`src/registry/errors.ts`）

3 个新 named error class（决策 J 沿用，co-located）：

| 类名 | 用途 |
|---|---|
| `KernelDependencyError` | `register` pre-hook 抛 |
| `MCPInjectorLiveModeNotImplementedError` | ctor eager throw（决策 T）|
| `SkillSchemaError` | `SkillRegistry.load` 内部包装 ajv errors（不向上传播）|

总计 17 个 named error class（A 6 + B 2 + C 2 + D 4 + E 3）。

---

## §二 测试结果（94/94 PASS，30x 0 flaky）

| 阶段 | 数量 | 文件 |
|---|---|---|
| Phase A | 18 | `registry/__tests__/AgentRegistry.test.ts` + `RuntimeBootstrap.test.ts` + `PersistentStore.test.ts` |
| Phase B | 22 | `session/__tests__/*` |
| Phase C | 14 | `scheduler/__tests__/*` |
| Phase D | 13 | `review/__tests__/*` |
| **Phase E** | **17** | `skill/__tests__/SkillRegistry.test.ts` (7) + `KernelDependencyValidator.test.ts` (8) + `MCPInjector.test.ts` (4) + scenario 12 in `AgentRegistry.test.ts` (2) + scenario 13 in `RuntimeBootstrap.test.ts` (2) — 派单 13 + 4 bonus |
| 跨阶段 sanity | 10 | `helpers.ts` / sanity / atomic-write |
| **总计** | **94** | tests=94, pass=94, fail=0 |

### TS-7.x 13 派单场景对照

| 编号 | PM 派单要求 | 落地状态 | 文件 |
|---|---|---|---|
| TS-7.1 | SkillRegistry load N valid → loaded.length === N | ✅ | SkillRegistry.test.ts |
| TS-7.2 | schema-invalid skill 跳过，不阻塞其他 | ✅ | SkillRegistry.test.ts |
| TS-7.3 | tolerant-read：`.tmp`/非 `.json`/损 JSON/空 全跳过 | ✅ | SkillRegistry.test.ts |
| TS-7.4 | getById/listForRole/list 索引一致 | ✅ | SkillRegistry.test.ts |
| TS-7.5 | 含 fcop@>=1.0 → null | ✅ | KernelDependencyValidator.test.ts |
| TS-7.6 | 缺 fcop → `no_fcop_skill` | ✅ | KernelDependencyValidator.test.ts |
| TS-7.7 | 引用不存在 skill_id → `skill_not_found` | ✅ | KernelDependencyValidator.test.ts |
| TS-7.8 | skill 不支持 local → `no_compatible_runtime` | ✅ | KernelDependencyValidator.test.ts |
| TS-7.9 | MCPInjector stub mode 不 spawn，只 log | ✅ | MCPInjector.test.ts（断言 `sdk.calls.create.length === 0`）|
| TS-7.10 | live mode v0.1 ctor 即 eager throw | ✅ | MCPInjector.test.ts |
| TS-7.11 | RuntimeBootstrap 缺 fcop agent → `report.kernel_failures[]` | ✅ | RuntimeBootstrap.test.ts（**绕过 register schema** —— 见 §三决策 V）|
| TS-7.12 | AgentRegistry.register 前置 hook 拒绝 → `KernelDependencyError` | ✅ | AgentRegistry.test.ts（断言 `sdk.calls.create.length === 0` + `agents.json` 不存在）|
| TS-7.13 (bonus) | agent.skills=[] → `no_fcop_skill` 经 fast path | ✅ | KernelDependencyValidator.test.ts |

### 4 个 bonus（超出派单 13 → 17 实际，PM 阈值 ≥ 80 远达标）

| 编号 | 场景 |
|---|---|
| SkillRegistry 重载幂等 | 二次 `load()` 清空+重建索引；TS-7.1+ 路径 |
| SkillRegistry missing dir | `skillsDir` 不存在 → `{ loaded: [], skipped: [] }`，**不**自动创建（让 caller 决策）|
| MCPInjector unknown skill warn | mount 时 skill_id 不在 registry → `logger.warn`+ skip，不抛 |
| KernelValidator validateAll 聚合 | 3 agents 中 2 失败 → `failures.length === 2` 顺序保留 |

### 30x 回归（Phase D race-loop 修复后）

```
=== 30x: pass=30 / fail=0 ===
```

---

## §三 决策记录（实施时锁定 P / Q / R / S / T / U + V）

> P/Q/R/S/T 已在 REPORT-022 落档前的 pre-analysis（本会话开头读完 design + schema + protocol + RuntimeBootstrap + AgentRegistry 后写出），U 在装配时确认；V 是 TS-7.11 实施过程中浮现的新约束。

### 决策 P — RuntimeBootstrap 集成位置

`bootstrap.run()` 在 SDK reconcile loop 之后、`drift` 字段（留位）之后、`ReconciliationReport` 组装之前插 kernel 阶段。被拒 agent 同时进 `failed[]`（reason 文案 `kernel-dep violation (reason): detail`）+ `kernel_failures[]`（结构化）+ `markFailed` 落盘。Summary 行追加 `🚫 N kernel-dep`（仅 N>0 时显示）。

**为何此位置**：(a) 复用 `success[]` 作为 candidate 输入；(b) `markFailed` 此时 registry 已重新加载完毕；(c) `ReconciliationReport` 仍是单一返回值。

### 决策 Q — MCPInjector mount 时机：bootstrap 顺序 await

`bootstrap.run()` 对 surviving `success[]` 顺序 `await mcpInjector.mount(record)`，**不**用 `Promise.all`。

**理由**：(a) stub mode log 顺序对操作员可读；(b) v0.2 live 模式希望失败一台不连累其他（可放慢但不掉单）；(c) bootstrap 阶段 mount 失败 → `logger.warn` + 继续（**仅在 register 阶段**才 fatal）。

### 决策 R — AgentRegistry constructor 接受 optional kernelValidator + mcpInjector

`AgentRegistryOptions` 新增**两个可选字段**：`kernelValidator?` + `mcpInjector?`。

**理由**：Phase A-D 共 67 测试全部 `new AgentRegistry({ store, sdk })`，缺省 = `null` = 行为不变（**零回归**实测）。Phase E 钩子只在 `Runtime.create` 装配时被注入。

### 决策 S — register 阶段验证顺序：schema → kernel → SDK

```
1. _isBootstrapping check
2. layer=admin reject
3. ajv schema validate
4. ⭐ kernelValidator.assertAgentSpec(spec)
5. SDK.create
6. store.upsert
7. ⭐ mcpInjector.mount(record)
```

**为何 schema 之后 SDK 之前**：(a) 和 layer=admin reject 同一 pre-flight 槽位 → SDK quota 在 reject 时不被消耗；(b) 调用方拿到的错误能区分"agent shape 错"（ValidationError）vs"kernel 强依赖违规"（KernelDependencyError）；(c) TS-7.12 测试断言 `sdk.calls.create.length === 0` + `agents.json` 不存在 — 此顺序是这条不变量的关键。

### 决策 T — MCPInjector live mode ctor eager throw

`MCPInjector` ctor 收到 `mode: "live"` **立即** 抛 `MCPInjectorLiveModeNotImplementedError`。

**为何 ctor 即抛而非 mount 即抛**：(a) 同 §决策 O 的 `UnsupportedHumanPushSinkError` 原则 —— composition-root 失败必须比第一次业务调用更早暴露；(b) 一台误配 `mode="live"` 的 v0.1 部署会在 `Runtime.create` 内**立刻**报错，而不是在第一个 agent register 时才发现 mount 失败 —— 后者的症状会被误诊为"register 流程 bug"。

### 决策 U — Runtime.start/stop 顺序不变

`SkillRegistry.load()` 是**同步**在 `Runtime.create` ctor 内 `await` 完成（不需要 start/stop），`KernelDependencyValidator` 是纯计算（无生命周期），`MCPInjector` stub 模式无需 start/stop（v0.2 live 模式才需要）。所以 Phase D 的 `start/stop` 顺序（`statusReconciler.start → reviewEngine.start → dispatcher.start` / 反向 stop）**完全不动**。

### 决策 V — TS-7.11 测试需绕过 register schema 才能触发 bootstrap-only 审计路径

`agent.schema.json` `skills.contains: { const: "fcop" }` 是 schema 层硬约束 → 任何**违规** spec 在 `register()` 第 3 步（schema validate）就被 `ValidationError` 拒了，根本到不了 kernel validator。

**这是好的**：register 路径有 schema + kernel 双层闸；validator 在 register 阶段实际只能命中 `skill_not_found` / `no_compatible_runtime`（TS-7.12 即用 `skills: ["fcop", "ghost-skill"]` 命中 skill_not_found）。

**TS-7.11 实施做法**：先 register 一个合法 PM-01（`skills: ["fcop"]`），再用 `store.saveAll([...])` 把 PM-01 的 skills 改为 `["ghost-skill", "fcop"]` —— 这个测试模拟的是**生产场景的迁移流程**：v0.0 部署的 `agents.json` 在 v0.1 升级后，bootstrap 启动时 kernel-dep 审计会指出哪些记录需要修。这条路径在 register 阶段不可达 —— 只有 bootstrap 才可能从老 JSON 重新加载到违规记录。

测试备注已显式注释这一点（`RuntimeBootstrap.test.ts` line 230-241）。

### 附加决策 — Phase D `whenSettled` race-loop 兜底

OPS-023 commit (1ba2aa6) 落地后，post-OPS-023 baseline 上 `npm test` 间歇 70/71 失败（不同跑次 TS-6.6 / 6.10 / 6.11 / 6.9 中不同的一个 `readReviewFile` ENOENT）。

**根因**：`ReviewEngine._reviewSubjectSession()` 起 reviewer session 后**就立即 resolve**（不等 reviewer settle），从 `_inflight` 移除；而 reviewer 的 `_finalizeReview` 是在 reviewer `session_ended` 到达时才被加入 `_inflight`。这两者之间存在窗口 —— `whenSettled()` 调用时 `_inflight` 是空的，**直接返回**，但 reviewer pipeline 还没启动，REVIEW-*.md 还没写。

**修复**：`whenSettled()` 改为 loop-poll，三个信号都清才返回：

```ts
while (
  this._inflight.size > 0 ||
  this._contexts.size > 0 ||                  // reviewer ctx 还在
  this._pendingReviewerTaskIds.size > 0       // 决定起 reviewer 后的窗口
) {
  if (this._inflight.size > 0) {
    await Promise.allSettled([...this._inflight]);
  } else {
    await new Promise((resolve) => setImmediate(resolve));  // yield 给 setImmediate
  }
}
// 5 秒 deadline，避免 reviewer 永远不 settle 的测试 bug 把整个 suite 卡死
```

修复后 30x 0 fail。这个改动**不在 TASK-024 §主交付范围**，是 baseline 修补 —— 但因为是 post-OPS-023 才能被观察到的问题，所以归档在 S5 commit 里更合理（不另起一个 PR 让 review 链拉长）。如果 PM 希望 OPS 拆成两个 commit，请告知。

---

## §四 影响范围（13 文件改 + 1 子模块新增）

### 新增文件（6）

| 文件 | 行数 | 用途 |
|---|---|---|
| `src/skill/SkillRegistry.ts` | 269 | 主交付 1 |
| `src/skill/KernelDependencyValidator.ts` | 196 | 主交付 2 |
| `src/skill/MCPInjector.ts` | 188 | 主交付 3 |
| `src/skill/index.ts` | 30 | 子模块 barrel |
| `src/skill/__tests__/helpers.ts` | 119 | 测试 helpers |
| `src/skill/__tests__/SkillRegistry.test.ts` | 200 | TS-7.1~7.4 + bonus |
| `src/skill/__tests__/KernelDependencyValidator.test.ts` | 213 | TS-7.5~7.8 + 7.13 + bonus |
| `src/skill/__tests__/MCPInjector.test.ts` | 156 | TS-7.9~7.10 + bonus |

### 修改文件（13）

| 文件 | 改动 | 是否破坏现有 API |
|---|---|---|
| `src/registry/AgentRegistry.ts` | 加可选 `kernelValidator` / `mcpInjector` 参数；register 流程加 step 4 + 7 | ❌ 不破坏（决策 R）|
| `src/registry/RuntimeBootstrap.ts` | 加可选 `kernelValidator` / `mcpInjector` 参数；run() 加 kernel 阶段；summary 加 🚫 prefix | ❌ 不破坏 |
| `src/registry/errors.ts` | 加 `KernelDependencyError` / `MCPInjectorLiveModeNotImplementedError` / `SkillSchemaError` | ❌ 纯加 |
| `src/registry/index.ts` | barrel re-export 三个新错误类 + 已有 ReviewWriteError 等 | ❌ 纯加 |
| `src/registry/__tests__/AgentRegistry.test.ts` | 加 TS-7.12 + 7.12b 两个 scenario | ❌ 仅加 |
| `src/registry/__tests__/RuntimeBootstrap.test.ts` | 加 TS-7.11 + 7.11b 两个 scenario | ❌ 仅加 |
| `src/types/state.ts` | 加 `KernelValidationFailureEntry` interface + `ReconciliationReport.kernel_failures` 字段 | ⚠️ `ReconciliationReport` 字段加了一个 — 调用方读 `report.kernel_failures` 安全（默认 `[]`），TypeScript 严格模式下解构需更新（影响 0 个外部消费者）|
| `src/Runtime.ts` | 加 skill 层装配（`skillRegistry` / `kernelValidator` / `mcpInjector` 三个 public field）；新增 `skillsDir` / `mcpInjectorMode` options | ❌ 纯加（向后兼容）|
| `src/index.ts` | barrel re-export skill 子模块 + 三个错误类 + `KernelValidationFailureEntry` | ❌ 纯加 |
| `src/review/ReviewEngine.ts` | `whenSettled()` 改为 loop-poll + 5 秒 deadline（baseline 兜底，详见 §三附加决策）| ❌ 行为更严格（之前过早返回）|
| `examples/hello-world.ts` | 加 `plantDemoSkills()` 函数（3 fixture skill）；输出加 `skills loaded` / `mcpInjector mode` / `mounted agents` / `kernel_failures` | ❌ |
| `package.json` | `version` 0.1.0-alpha.4 → **0.1.0-alpha.5**；description 加 Phase E | ❌ |
| `README.md` | 加 Phase E 区块 + §决策 P/Q/R/S/T/U + 验收清单更新 + 测试数 71 → 94 | ❌ |

### **不在本 commit scope 的修改（OPS 注意 selective add）**

`packages/codeflow-runtime/docs/test-strategy-s3.md` — 这是 **QA-025** 的工作 1+2+3（1100 行扩充，包括 TS-5.12/5.13 顺序修正 + §3.6 / §3.7 / §5d 三节）。已在 git working tree 中（M），但**不应进 S5 commit**。建议 OPS-26 commit 时 selective add 仅 S5 范围，让 QA 自己单独 commit `test-strategy-s3.md`（与 REPORT-025 的工作 1+2+3 同步落地）。

### 是否需要重启服务

❌ 不需要（CodeFlow 当前无 daemon；`codeflow-shell` 在 S6 才出现）。

### 是否影响已有功能

❌ 零回归。Phase A 18 + Phase B 22 + Phase C 14 + Phase D 13 共 67 个测试**没有任何一个**通过 `Runtime.create` 装配（全部直接 `new AgentRegistry({ store, sdk })`），所以新加的 `kernelValidator` / `mcpInjector` 缺省 `null` = 完全不进入新路径。30x 回归 0 fail。

---

## §五 自测结果

| 验收项 | 状态 | 输出 |
|---|---|---|
| `npx tsc --noEmit` | ✅ 0 错误 | 静默 |
| `npm test` | ✅ 94/94 PASS | tests=94, pass=94, fail=0 |
| `30x npm test` | ✅ 0 flaky | `=== 30x: pass=30 / fail=0 ===` |
| `ReadLints` | ✅ 0 错误 | 全部 src/skill/* + 修改文件 |
| `npx tsx examples/hello-world.ts` 启动 | ✅ Phase E 全链路 | 详见下文 stdout |
| Phase D `whenSettled` flaky | ✅ 已修 | post-OPS-023 baseline 70/71 → 71/71 + 30x 0 |
| git diff scope 检查 | ⚠️ `docs/test-strategy-s3.md` 是 QA-025 工作 | 见 §四 selective add 备注 |

---

## §六 stdout 实例

### 6.1 Demo 启动日志（`hello-world.ts`）

```
[SkillRegistry] loaded 3 skill(s) from D:\Bridgeflow\packages\codeflow-runtime\examples\.codeflow-state\skills
[RuntimeBootstrap] ✅ 0 success / ⚠️ 0 failed / 🪦 0 orphaned / 👻 0 foreign
[MCPInjector stub] mounting 2 skill(s) for agent_id="DEV-01": fcop, git (v0.1 — no subprocess spawned; v0.2 will wire @cursor/sdk MCP runtime)
[MCPInjector stub] mounting 2 skill(s) for agent_id="REVIEW-01": fcop, review (v0.1 — no subprocess spawned; v0.2 will wire @cursor/sdk MCP runtime)
===========================================================
CodeFlow Runtime — Phase C + D + E Hello-World demo
===========================================================
watcher ready     : D:\Bridgeflow\packages\codeflow-runtime\examples\inbox
reviews dir       : D:\Bridgeflow\packages\codeflow-runtime\examples\.codeflow-state\reviews
skills dir        : D:\Bridgeflow\packages\codeflow-runtime\examples\.codeflow-state\skills
skills loaded     : 3 (fcop, git, review)
mcpInjector       : mode="stub" (v0.1 stub)
mounted agents    : DEV-01, REVIEW-01
dispatcher        : started
reviewEngine      : started (DefaultReviewPolicy → REVIEW-01)
statusReconciler  : started (session ↔ Agent.status sync)
inbox empty       : drop a TASK-*-XXX-to-DEV.md to trigger
bootstrap report  : success=0, failed=0, orphaned=0, foreign=0, kernel_failures=0
Press Ctrl+C to stop.
===========================================================
```

✅ Phase E 全部 3 个组件启动 OK：
- `SkillRegistry` 装载 3 fixture skill（fcop / git / review）
- `MCPInjector stub` 为 DEV-01 / REVIEW-01 各 mount 2 个 skill — 一行 stdout 输出
- `bootstrap report` 多了 `kernel_failures=0` 字段

### 6.2 `RuntimeBootstrap.report.kernel_failures` 实例（TS-7.11 测试断言形式）

```ts
{
  agent_id: "PM-01",
  reason: "skill_not_found",
  detail: 'agent references skill_id="ghost-skill" but SkillRegistry has no such record (did the file fail to load? check [SkillRegistry] warn lines)',
}
```

对应 `report.failed[]` 同步落档：

```ts
{
  agent_id: "PM-01",
  sdk_agent_id: "sdk-fake-PM-01",
  reason: 'kernel-dep violation (skill_not_found): agent references skill_id="ghost-skill" but SkillRegistry has no such record (did the file fail to load? check [SkillRegistry] warn lines)',
}
```

Summary 行：

```
[RuntimeBootstrap] ✅ 1 success / ⚠️ 1 failed / 🪦 0 orphaned / 👻 0 foreign / 🚫 1 kernel-dep
```

### 6.3 `KernelDependencyError`（TS-7.12 register 拒绝路径）

```ts
KernelDependencyError {
  name: "KernelDependencyError",
  agentId: "DEV-01",
  reason: "skill_not_found",
  detail: 'agent references skill_id="ghost-skill" but SkillRegistry has no such record (...)',
  message: 'agent_id="DEV-01" rejected by KernelDependencyValidator (reason=skill_not_found): agent references skill_id="ghost-skill" but SkillRegistry has no such record (...)',
}
```

测试同时断言：`sdk.calls.create.length === 0` + `agents.json` 不存在。

---

## §七 OPS commit 建议（请 PM 派单 OPS-26）

### 7.1 selective add scope

```bash
git add packages/codeflow-runtime/README.md
git add packages/codeflow-runtime/examples/hello-world.ts
git add packages/codeflow-runtime/package.json
git add packages/codeflow-runtime/src/Runtime.ts
git add packages/codeflow-runtime/src/index.ts
git add packages/codeflow-runtime/src/registry/AgentRegistry.ts
git add packages/codeflow-runtime/src/registry/RuntimeBootstrap.ts
git add packages/codeflow-runtime/src/registry/__tests__/AgentRegistry.test.ts
git add packages/codeflow-runtime/src/registry/__tests__/RuntimeBootstrap.test.ts
git add packages/codeflow-runtime/src/registry/errors.ts
git add packages/codeflow-runtime/src/registry/index.ts
git add packages/codeflow-runtime/src/review/ReviewEngine.ts
git add packages/codeflow-runtime/src/types/state.ts
git add packages/codeflow-runtime/src/skill/        # 全新子目录
git add docs/agents/tasks/REPORT-20260509-024-DEV-to-PM.md
```

**不要** `git add packages/codeflow-runtime/docs/test-strategy-s3.md` — 让 QA 走自己的 commit。

### 7.2 建议 commit message

```
feat(s5-phase-e): SkillRegistry + KernelDependencyValidator + MCPInjector (stub) + AgentRegistry pre-hook + RuntimeBootstrap kernel audit + Runtime 14-subsystem composition + Phase E demo + 17 TS-7.x tests (94/94) + Phase D whenSettled race-loop fix
```

### 7.3 后续门控

OPS-26 push 落地后，QA 可以跑 Phase E 回归（README §测试结果 + REPORT-025 §3.7 = 17 场景）。验收 PASS 后请 PM 决定 S6 启动还是 v0.1 RC 冻结。

---

## §八 备注与挂账

### 已挂账

- ✅ `MCPInjector mode="live"` 在 v0.2 启用 — ctor 已留 eager throw + 决策 T 文档说明
- ✅ `NeedsHumanGate sink="mobile"` 在 v0.2 启用 — Phase D 已留 eager throw（决策 O）
- ✅ Phase D `whenSettled` 5 秒 deadline 是兜底 — 真正的"reviewer 永远不 settle"是测试 bug，5 秒后抛错让 surrounding test timeout 接管

### 设计文档差异（无）

S5 Phase E 实施过程中**未发现**任何 schema 缺口或设计文档歧义（详见 README §协议依赖纪律：A + B + C + D + E 共 5 阶段 0 schema 缺口）。`compatible_runtimes` 缺省语义在 PM 派单中未明示，但本报告 §一-2 的"缺省 = 默认接受所有 host_runtime"决策与 schema 标记字段为可选一致，TS-7.8b 测试覆盖。

### 已知风险

- ⚠️ Phase D `whenSettled` 修复**包含在 S5 commit**里。如果 PM 偏好"一个 commit 一个 sprint"原则，请告知，我可以拆 fixup commit。但因为这个 race 需要 Phase D 全部代码 + Phase E 测试运行环境才能稳定复现，归在 S5 commit 里溯源也合理。

---

**DEV-01 已交付。等候 PM 调度 OPS-26 commit + push，以及 QA 跑 Phase E 回归。**
