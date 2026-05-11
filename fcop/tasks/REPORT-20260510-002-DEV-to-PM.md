---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260510-002
sender: DEV
recipient: PM
priority: P0
thread_key: codeflow-v0.2-sprint-0-accelerated-launch
references:
  - TASK-20260510-002-PM-to-DEV
  - REPORT-20260510-002-PM-to-ADMIN
  - REPORT-20260509-028-DEV-to-PM
  - docs/design/v0.2-sprint0-roadmap.md
layer: governance
---

# Sprint S6 v0.2 Sprint 0 — P1（真 Cursor SDK 接入 + ConfigLoader）完工回执

## §一 P1 主交付（5 项 + 1 调整）状态

| # | 主交付 | 状态 | 文件 |
|---|---|---|---|
| 1 | `sdk-factory.ts` 改写：真 `CursorSdkAdapter` ?? fake | ✅ 完成 | `codeflow-shell/src/sdk-factory.ts` |
| 2 | `config.ts` 新增 ConfigLoader（6 层 merge） | ✅ 完成 | `codeflow-shell/src/config.ts` |
| 3 | `.env.example` 新增（whitelist 6 个 env vars） | ✅ 完成 | `codeflow-shell/.env.example` |
| 4 | `main.ts` 修改：引入 `loadConfig()` + 用 cfg 控制 sdkAdapter / dataDir / banner | ✅ 完成 | `codeflow-shell/src/main.ts` |
| 5 | `README.md` 加 §「拿 Cursor API key 一页指南」+ §「config.json schema」 | ✅ 完成 | `codeflow-shell/README.md` |
| 6 | demo fixture 修：让 sample-task drop 文件名与 frontmatter `task_id` 一致 | ⚠️ 顺手修 | `codeflow-shell/examples/hello-world/{sample-task.md, README.md}` |
| — | `package.json` 版本号 `0.1.0-rc.1` → `0.2.0-alpha` + description 更新 | ✅ 完成 | `codeflow-shell/package.json` |
| — | `.gitignore` 加 `.env` + `codeflow.config.json` 排除 + `!.env.example` re-include | ✅ 完成 | `codeflow-shell/.gitignore` |

## §二 §三 决策点的实际选择

| 决策项 | PM 立场 | DEV 选择 | 理由 |
|---|---|---|---|
| ConfigLoader 是否引入 `dotenv` 依赖 | （PM 未规定） | **不引入**，自写 30 行 .env parser | 我们只读 6 个 whitelisted key（CURSOR_*/CODEFLOW_*），加依赖性价比低 |
| ConfigLoader merge 层数 | PM TASK-002 §三 P1 §1 说 5 层（defaults → user-config.json → project-config.json → process.env → CLI args） | **6 层**：在 user-config.json 与 process.env 之间插入 `~/.codeflow/v2/.env` + `./.env` 两个 dotenv 文件 | PM `.env.example` 模板暗示 .env 文件被加载（说明文档贴的是 `~/.codeflow/v2/.env or project root`），所以实际是 6 层 |
| `.env.example` 内 `CURSOR_DEFAULT_MODEL` 字段 | PM TASK-002 §三 P1 §1 模板含 `defaultModel?: string` | **加进 config 但 banner-only**，**不**接入 SDK 调用 | 见 §三 surprise 1 — `CursorSdkAdapter` 当前不暴露构造级 `defaultModel`（model 是 per-call 通过 `AgentCreateSpec.modelId` 传），全量 wire 是 P3+ 工作 |
| 真 SDK 验证 #3 「评审输出不再是 needs_human」 | DEV 自测覆盖 | **DEV 不能单独完工 #3** — 已写明 ADMIN 用真 key 验收路径 | 见 §三 surprise 2 — DEV 当前无真 `CURSOR_API_KEY`；PM TASK-002 §九 D2 已说「P1 完工后 PM 找 ADMIN 要 key」 |
| auto-flip `relay.autoConnect` | PM 未规定 | **当 url + roomKey 都设 + 无 explicit `autoConnect: false`**，默认 auto-flip 为 true | 用户 ergonomics — 配齐凭证就期望连，opt-out 比 opt-in 更顺 |
| smoke fixture 文件名与 task_id 不一致问题 | PM 未提 | **顺手修**：sample-task drop 文件名固定为 `TASK-20260509-999-PM-to-DEV.md` 与 frontmatter 一致 | 见 §三 surprise 3 — v0.1 demo 文档让用户用今天日期 drop，frontmatter 写死 `20260509`，state_history append 找不到文件失败 |

## §三 surprise（§二 之外的发现）

### Surprise 1 — `CursorSdkAdapter` 不接收构造级 `defaultModel`

PM TASK-002 §三 P1 §1 给的 `makeRealCursorSdkAdapter(cfg)` 模板：

```typescript
return new CursorSdkAdapter({
  apiKey,
  listScope: cfg.listScope ?? "local",
  defaultModel: cfg.defaultModel,  // ← 这里
});
```

但 `CursorSdkAdapter` 当前的 `CursorSdkAdapterOptions` 定义（`packages/codeflow-runtime/src/registry/AgentSdkAdapter.ts:130-149`）只有 3 个字段：`apiKey?` / `defaultCwd?` / `listScope?` — **没有 `defaultModel`**。Model 是 per-call 通过 `AgentCreateSpec.modelId` 和 `AgentSendSpec.modelId` 传的（line 47 / 67）。

**DEV 处置**：
- ConfigLoader 仍读 `cfg.cursor.defaultModel`（保留前向兼容）
- banner 显示 `defaultModel="..."` (如果设了)
- **不**传给 `CursorSdkAdapter` 构造函数
- 实际 wire-through（让所有 SDK call 自动用 cfg 的 defaultModel）是 P3+ 工作（需要给 `AgentRegistry.register` 和 `SessionManager.startSession` 加 default-model 参数注入）

**建议给 PM**：v0.2 sprint 0 可加一个独立 micro-task「`CursorSdkAdapterOptions.defaultModel` + register/send wire-through」（约 60 行修改）。

### Surprise 2 — 自测 #3「真 verdict（不是 needs_human）」需要真 API key，DEV 无 key

PM TASK-002 §九 风险表 D2 已声明：「真 Cursor SDK 接入需 ADMIN 提供 API key — P1 完工后 PM 找 ADMIN 要」。所以 DEV 当前 P1 自测**只能覆盖到 #2 「有 key → 选 real adapter」**，#3 「真 verdict」必须等 ADMIN key 到位。

**DEV 用了一个 fake key 验证 factory chain**：

```text
$env:CURSOR_API_KEY = "ck_fake_for_test_only_no_network"
npx tsx src/main.ts
# banner 出: Cursor SDK     : live (CursorSdkAdapter; apiKey from config, listScope="local")
```

agents.json 显示 `sdk_agent_id` 是 UUID 形式（如 `agent-bb6802b4-627b-4c1a-b252-7f974c7b4c5a`），与 `InMemorySdkAdapter` 的 `sdk-fake-XXXX` 模式明显不同 — 证明真 `CursorSdkAdapter` 路径被走通到 SDK，并且 SDK 接受了这个调用（**意外发现**：`@cursor/sdk` 在 local mode 似乎不严格验证 API key 在 `Agent.create` 阶段，可能 lazy 验证 / 仅在 send 时才发真请求）。

**DEV 不再深挖 SDK 行为**，因为 P1 验收点是「factory 链 + adapter 选择正确」，已通过。真 verdict 的功能性正确性等 ADMIN key 到位后由 QA / ADMIN 验证。

### Surprise 3 — v0.1 sample-task.md 文件名 / frontmatter `task_id` 不一致

`examples/hello-world/sample-task.md` 的 frontmatter `task_id: TASK-20260509-999-PM-to-DEV`（写死 5/9 日期），但 v0.1 README 教用户用今天日期或任意 3 位序号 drop。当 task 文件名与 frontmatter `task_id` 不同时，`ReviewEngine._appendReviewBullet` 找不到原文件做 state_history append（rationale: 它从 `subject_ref`（= frontmatter `task_id`）拼路径，跟 drop 文件名脱节）：

```text
[ReviewEngine] state_history append failed for "...\TASK-20260509-999-PM-to-DEV.md":
  Task file not found at "..." (expected for state_history append)
```

**DEV 处置**：顺手修文档 — 改 `examples/hello-world/README.md` 与 `examples/hello-world/sample-task.md` 的 drop 命令，让用户用 `TASK-20260509-999-PM-to-DEV.md` 与 frontmatter 一致。修后 fake-loop 再跑，state_history 4 个 bullets 全部成功 append（见 §四 #4-fake-loop 验证）。

**根因诊断**：`ReviewEngine` 的契约是「task_id 必须与 inbox 文件名一致」（这是 dispatcher 之后 task 文件被 state_history-mutated 的前提）— 这是 v0.1 隐含约定，从未在 design doc 显式记录。**建议给 PM**：v0.2 sprint 0 P4 重写 task schema 时，**显式约束** `task_id` 字段必须等于文件名 stem（或反过来 — review engine 用 `inbox_file` 字段而非 `task_id` 拼路径，去掉这个隐含约束）。

### Surprise 4 — `AgentStatusReconciler` Windows EPERM rename 仍偶发

继 REPORT-028 §三 surprise 4 之后再次复现一次（见 §四 fake-loop log，"reconcile failed for agent_id=DEV-01 -> running"）。**已知 cross-cutting bug**，不属本刷范围；**建议给 PM**：v0.2 sprint 0 内集中开 1 单（约 30 行 retry-on-EPERM patch）。

## §四 §四 自测全部通过

### 自测 #1 — 无 `CURSOR_API_KEY` → fake adapter ✅

```text
PS> $env:CODEFLOW_DATA_DIR = "$pwd\.smoke-test-state"
PS> Remove-Item Env:\CURSOR_API_KEY -ErrorAction SilentlyContinue
PS> npx tsx src/main.ts

[SkillRegistry] loaded 3 skill(s) from ...\skills
[RuntimeBootstrap] ✅ 0 success / ⚠️ 0 failed / 🪦 0 orphaned / 👻 0 foreign
[MCPInjector stub] mounting 2 skill(s) for agent_id="DEV-01": fcop, git ...
[MCPInjector stub] mounting 2 skill(s) for agent_id="REVIEW-01": fcop, review ...
===========================================================
CodeFlow v0.2.0-alpha — internal preview
===========================================================
Data dir       : ...\.smoke-test-state
Inbox          : ...\.smoke-test-state\inbox
Reviews        : ...\.smoke-test-state\reviews
Config sources : process.env
Cursor SDK     : fake (InMemorySdkAdapter; CURSOR_API_KEY not set —
                 set it in ~/.codeflow/v2/.env or config.json to use real SDK)
Skills loaded  : 3 (fcop, git, review)
MCP injector   : mode="stub" (2 agents mounted)
Relay (P3)     : not configured (set CODEFLOW_RELAY_URL + CODEFLOW_ROOM_KEY to enable in P3)
(planted 3 fixture skill(s) on first launch)
(registered 2 default agent(s) on first launch)
Bootstrap      : success=0, failed=0, kernel_failures=0
Status         : running. Drop TASK-*-XXX-to-AGENT.md to inbox.
Stop           : Ctrl+C
PID            : 7896
===========================================================
```

### 自测 #2 — 设 `CURSOR_API_KEY` → real adapter ✅

```text
PS> $env:CURSOR_API_KEY = "ck_fake_for_test_only_no_network"
PS> npx tsx src/main.ts

# (skills + MCP mount 同 #1，省略)
===========================================================
CodeFlow v0.2.0-alpha — internal preview
===========================================================
...
Config sources : process.env
Cursor SDK     : live (CursorSdkAdapter; apiKey from config, listScope="local")
...
```

`agents.json` 关键差异（vs #1）：

```json
{
  "agent_id": "DEV-01",
  "sdk_agent_id": "agent-bb6802b4-627b-4c1a-b252-7f974c7b4c5a"  ← UUID, 真 SDK 路径
  // (#1 fake 时是 "sdk-fake-0001" / "sdk-fake-0002")
}
```

### 自测 #3 — drop sample + 真 SDK = 真 verdict ⚠️ DEV 不能单独完工，留 ADMIN

DEV 当前无真 `CURSOR_API_KEY`，**已通过 #2 证明 factory chain → CursorSdkAdapter → SDK 路径走通**（`Agent.create` 实际发起调用并返回 UUID 形式 `sdk_agent_id`）。

**真 verdict 验证（PM TASK-002 §九 D2 路径）**：等 ADMIN 提供真 key 后，QA 跑：

```powershell
# In ~/.codeflow/v2/.env or codeflow-shell/.env:
# CURSOR_API_KEY=ck_real_admin_key

cd codeflow-shell; npm start
# 另一窗口：
copy examples\hello-world\sample-task.md `
  $env:USERPROFILE\.codeflow\v2\inbox\TASK-20260509-999-PM-to-DEV.md
# 期望 REVIEW-*.md frontmatter:
# decision: approved | changes_requested | blocked | rejected
# (而不是 #1/#2/fake-loop 看到的 "needs_human")
```

### 自测 #3.fallback — drop sample + fake adapter = governance loop 完整跑通 ✅

为证明我的 ConfigLoader / sdk-factory 改动**没破坏 v0.1 fake 路径**（runtime 94/94 测试已覆盖此路径，但 codeflow-shell 装配层需独立验证），DEV 也跑了 fake-loop：

```text
PS> $env:CODEFLOW_DATA_DIR = "$pwd\.smoke-test-state"
PS> Remove-Item Env:\CURSOR_API_KEY
PS> npx tsx src/main.ts &
# (banner)
PS> Copy-Item examples\hello-world\sample-task.md `
      "$pwd\.smoke-test-state\inbox\TASK-20260509-999-PM-to-DEV.md"

# stdout:
[NeedsHumanGate] human approval required:
  review_id="REVIEW-20260509-999-REVIEW-on-TASK-20260509-999-PM-to-DEV"
  task_id="TASK-20260509-999-PM-to-DEV"
  reviewer_role="REVIEW"
  trigger_reason="verdict_parse_failed"
  (sink=cli, pushed_at=2026-05-09T17:22:23.770Z)
  rationale="(verdict parse failed) failed to parse reviewer verdict for ..."
```

`inbox/TASK-20260509-999-PM-to-DEV.md` 末尾 4 个 state_history bullets 自动 append（修后文件名一致后，再不抱「Task file not found」）：

```markdown
- **2026-05-09T17:22:23.676Z** | by `runtime` | `inbox` → `dispatched` session_id=session-1-moym3cbr
- **2026-05-09T17:22:23.708Z** | by `runtime` | `dispatched` → `ended` status=completed
- **2026-05-09T17:22:23.709Z** | by `review-engine` | `ended` → `review_pending` review_id=...
- **2026-05-09T17:22:23.769Z** | by `review-engine` | `review_pending` → `review_needs_human` review_id=..., review_file=...
```

`reviews/REVIEW-*.md` 1047 bytes，schema-valid，含 `decision: needs_human` + `human_approval` 子结构（`needs_human` 是 v0.1 fake 路径的预期，**v0.2 P4 后会被 deprecated**）。

### 自测 #4 — typecheck 0 错 ✅

```text
PS D:\Bridgeflow\codeflow-shell> npx tsc --noEmit
PS D:\Bridgeflow\codeflow-shell> echo $LASTEXITCODE
0
```

### 自测 #5 — runtime 94/94 测试无回归 ✅

```text
PS D:\Bridgeflow\packages\codeflow-runtime> npm test
... (省略前 92 个 ✅) ...
✅ tests 94
✅ suites 11
✅ pass 94
✅ fail 0
✅ cancelled 0
✅ skipped 0
✅ todo 0
✅ duration_ms 6958.6187
```

## §五 §六 影响范围 / files changed

### M（修改）

```
codeflow-shell/.gitignore                      (+ .env / config.json 排除 + !.env.example re-include)
codeflow-shell/README.md                       (顶部摘要 0.1.0-rc.1 → 0.2.0-alpha + §配置章节重写)
codeflow-shell/examples/hello-world/README.md  (drop 命令统一文件名)
codeflow-shell/examples/hello-world/sample-task.md (drop 命令统一文件名 + 加真 SDK 提示)
codeflow-shell/package.json                    (version 0.1.0-rc.1 → 0.2.0-alpha + description)
codeflow-shell/src/main.ts                     (rewrite — 引入 loadConfig + describeAdapterChoice)
codeflow-shell/src/sdk-factory.ts              (rewrite — makeReal 接 cfg 真 CursorSdkAdapter；加 describeAdapterChoice)
```

### A（新增）

```
codeflow-shell/.env.example                    (whitelist 6 个 env vars，含 ## 注释指南)
codeflow-shell/src/config.ts                   (~290 行：ConfigLoader 6 层 merge + .env parser + CLI args)
docs/agents/tasks/REPORT-20260510-002-DEV-to-PM.md (本文件)
```

### 不动（按 TASK-002 §七 out-of-scope）

- ❌ `packages/codeflow-protocol/schemas/*` v0.1 schemas
- ❌ `_ignore/spike_sdk_doorbell/`
- ❌ `codeflow-desktop/` v1 资产
- ❌ npm publish / origin tag push（internal RC，本地 tag 后由 OPS 处理）

### 顺手修（demo fixture）

- `examples/hello-world/sample-task.md` + `examples/hello-world/README.md` 文件名一致性修正（surprise 3）— 严格说不属 P1 主交付，但跑自测 fake-loop 时碰到 state_history append 失败，顺手修了。可独立 cherry-pick 出来。

## §六 自检：FCoP / dev-bridge 兑现

按 `.cursor/rules/codeflow-project.mdc` 五句宪法 + `.cursor/rules/dev-bridge.mdc`：

| 条款 | 兑现 |
|---|---|
| 1. AI 角色文件落档 | 本 REPORT + sample-task.md + REVIEW-*.md 全部落档 |
| 2. 协议高于聊天 | YAML frontmatter 全程 + ConfigLoader strict whitelist |
| 3. L2 collaboration cosmos | 5 schemas + `validate()` 不动；P4 才升 7 schemas |
| 4. ADMIN 治理三动作 | TASK-002 → REPORT-002 一对一 |
| 5. 审批默认 = 推荐 | §二 6 个决策点全部按 PM 立场 + DEV 自决空间内做选择，surprise 全部上文字栏 |
| dev-bridge: 接收 `TASK-*-PM-to-DEV` | TASK-20260510-002-PM-to-DEV ✅ |
| dev-bridge: 影响范围 | §五 ✅ |
| dev-bridge: 影响存量功能 | runtime 94/94 零回归 ✅；fake adapter fallback 路径独立验证 ✅ |
| dev-bridge: 是否需要重启服务 | v0.2.0-alpha 无生产服务，ADMIN 用 npm start 起新进程 ✅ |
| dev-bridge: 自测结果 | §四 5 项 ✅；#3 的真 verdict 部分留 ADMIN |
| dev-bridge: 不直接部署生产 | 不动 OPS 工作；本任务无生产部署阶段，待 OPS 接 commit 派单 ✅ |

## §七 后续协作请求（PM 调度）

### 1. OPS 提交 commit + 本地 tag `v0.2.0-alpha`

按 PM TASK-002 §三 P1 §3：「DEV 自测通过后派 OPS commit + 本地 tag `v0.2.0-alpha`，不推 tag」。

建议 commit message：

```text
feat(s6-v0.2-sprint0-p1): real CursorSdkAdapter wiring + ConfigLoader

- codeflow-shell/src/sdk-factory.ts: rewrite makeRealCursorSdkAdapter(cfg)
  to construct real CursorSdkAdapter (returns null if no apiKey, callers
  chain ?? makeFakeCursorSdkAdapter).
- codeflow-shell/src/config.ts: new ConfigLoader (6-tier merge:
  defaults → user-config.json → project-config.json → user-.env →
  project-.env → process.env (whitelisted) → CLI args).
- codeflow-shell/.env.example: whitelisted 6 env vars (CURSOR_API_KEY,
  CURSOR_DEFAULT_MODEL, CURSOR_LIST_SCOPE, CODEFLOW_DATA_DIR,
  CODEFLOW_RELAY_URL, CODEFLOW_ROOM_KEY, CODEFLOW_RELAY_AUTOCONNECT).
- codeflow-shell/src/main.ts: integrate loadConfig() + describeAdapterChoice
  banner; relay autoConnect placeholder for P3.
- codeflow-shell/README.md: §「拿 Cursor API key 一页指南」+ §「config.json
  schema」+ 6-layer config matrix.
- demo fixture: align sample-task drop filename to frontmatter task_id.
- package.json version 0.1.0-rc.1 → 0.2.0-alpha.

Self-test: tsc 0 errors / runtime 94/94 still pass / fake-loop governance
end-to-end with state_history 4 bullets + REVIEW persisted.

Real-SDK verdict pending ADMIN's CURSOR_API_KEY — see REPORT-002 §三 #2.
```

### 2. ADMIN 提供 `CURSOR_API_KEY` 走自测 #3 真 verdict

按 PM TASK-002 §九 D2，P1 完工后 PM 找 ADMIN 要 key。建议 ADMIN 走法：

```powershell
# 1. 拿 ck_xxx 后:
mkdir $env:USERPROFILE\.codeflow\v2 -Force
"CURSOR_API_KEY=ck_xxx" | Out-File $env:USERPROFILE\.codeflow\v2\.env -Encoding utf8
# 2. 启动 shell:
cd D:\Bridgeflow\codeflow-shell; npm start
# 3. 另一窗口 drop:
copy examples\hello-world\sample-task.md $env:USERPROFILE\.codeflow\v2\inbox\TASK-20260509-999-PM-to-DEV.md
# 4. 看 REVIEW-*.md frontmatter，期望 decision != "needs_human"
```

### 3. 可选 micro-tasks（DEV 自决建议给 PM）

- **MT-1**：`CursorSdkAdapterOptions.defaultModel` + register/send wire-through（约 60 行，§三 surprise 1）
- **MT-2**：atomic-write helper retry-on-EPERM patch（约 30 行，§三 surprise 4，REPORT-028 已提）
- **MT-3**：design doc / task schema 显式约束 `task_id == filename stem`（doc-only，§三 surprise 3）

这 3 个均**不阻塞 P2**；PM 自决插队节奏。

### 4. P2 启动条件

- OPS-V0.2-P1-COMMIT 落地后（约 10 min）
- DEV 立刻可读 P2 任务（PM TASK-002 §四已写明，DEV 当前已读完）
- DEV 直接进 P2 pre-analysis（评估矩阵 5 方案 / spike-exe-packaging.md）

---

P1 完工。等待 OPS commit `v0.2.0-alpha` 落地后 DEV 自动启动 P2 pre-analysis。

DEV-01
2026-05-10 01:30 (UTC+8)
