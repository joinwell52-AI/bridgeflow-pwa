---
protocol: fcop
version: 1
kind: report
task_id: REPORT-20260510-010
sender: DEV
recipient: PM
priority: P0
thread_key: codeflow-v0.2.0-beta-hotfix-mt-1-defaultmodel-wire-through
references:
  - TASK-20260510-010-PM-to-DEV
  - REPORT-20260510-009-QA-to-PM
  - REPORT-20260510-007-DEV-to-PM
layer: worker
---

# REPORT-20260510-010：MT-1 defaultModel wire-through hotfix 完工

## §一 TL;DR

- ✅ **5 主交付 + 1 文档 + 1 额外** 全部完工：`CursorSdkAdapterOptions.defaultModel` 字段加好；`.create()` / `.send()` 用 `spec.modelId ?? this._opts.defaultModel` 兜底链；`sdk-factory.ts` 透传 `cfg.cursor.defaultModel`；`.env.example` 取消注释 `CURSOR_DEFAULT_MODEL=auto` + 升级警示文案；`AgentSdkAdapter.test.ts` 新增 TS-MODEL-1..5 五个 monkey-patch seam 测试；shell `main.ts` 新增 banner WARNING 块（live + local + 无 model → 提示用户在第一次 task drop 失败前看到原因）；README §"Quick start: getting a Cursor API key" 加 step 4 解释 local-mode model 要求。
- ✅ **runtime tests 99 → 104**（+5: TS-MODEL-1..5），全 1 次 0 fail 0 flake。
- ✅ **5 自测项执行**（含两条 SDK seam 实证：fake key + 不传 model SDK 不校验，**fake key + 传 model SDK 立即返回 internal error 因为 model="auto" 触发真验证 path** —— 反向证明 wire-through 起效）。
- ✅ **BUG-SDK-001 闭环**：QA-009 §五 BUG-SDK-001 的根因（`Agent.create({ local })` 在 send 阶段要求 explicit model）已通过 wire-through 解决；A-08/A-10 的最终验证需 ADMIN 真 key 跑（DEV 无法 echo key 进 stdout，故留 QA-011）。
- 🔍 **3 surprises**（详见 §五），无阻塞。
- ⚪ **QA-009 §六 RuntimeBootstrap foreign>0 现象** = 设计正确行为（同 cwd 下历次 SDK agents 累积），不是 bug，§六-2 给出 PM 转 QA 的解释。
- 双双升 `0.2.0-beta.1`；`codeflow-shell` + `@codeflow/runtime` 同步；main.ts `VERSION` 字串、3 包 description 全部对齐。

派 OPS：本 REPORT 末尾 §七。**SLA 目标 ≤ 90 min，实际约 70 min。**

## §二 5 主交付 diff 概要

### 2.1 `packages/codeflow-runtime/src/registry/AgentSdkAdapter.ts`

| 改动 | 关键代码 |
|---|---|
| `CursorSdkAdapterOptions` 加 `defaultModel?: string` 字段 + JSDoc 解释 BUG-SDK-001 + 引用 TASK-010 §3.1 + REPORT-009 §五 | （在 `listScope` 字段下方追加） |
| `create()` 在 `Agent.create` 调用前用 `const modelId = spec.modelId ?? this._opts.defaultModel;` 解析后再走 `...(modelId ? { model: { id: modelId } } : {})` | line 167-180（新解析 + 改造原有 spread） |
| `send()` 同样改造（先解析 modelId 再 spread）| line 232-243 |

**关键决策**：`resume()` 方法（仅作 RuntimeBootstrap reconciler 的 SDK liveness probe）**不**注入 model — 它不调 `agent.send()`，QA 错误信息也明确说"to Agent.create() or to send()"，没列 resume。如未来发现 resume 也需要 model（某些 SDK 版本可能要求），加 1 行同样的 `modelId` 解析即可，本 sprint 不动避免越界。

### 2.2 `codeflow-shell/src/sdk-factory.ts`

| 改动 | 关键代码 |
|---|---|
| `CursorAdapterConfig.defaultModel` 的 JSDoc 升级：从「NOT yet wired ... P3+ follow-up」改为「MT-1 (v0.2.0-beta.1): now wired all the way」 | line 38-49 |
| `makeRealCursorSdkAdapter` 在 `new CursorSdkAdapter({...})` 里加 `...(cfg.defaultModel ? { defaultModel: cfg.defaultModel } : {})` | line 80-86 |
| File header version 从 `v0.2.0-beta` 升 `v0.2.0-beta.1`，加 `MT-1 hotfix` 章节解释 BUG-SDK-001 + 链 TASK-010 §3.3 | line 1-23 |

### 2.3 `codeflow-shell/.env.example`

`CURSOR_DEFAULT_MODEL=claude-sonnet-4`（**注释状态**）→ `CURSOR_DEFAULT_MODEL=auto`（**取消注释**）+ 上方 16 行新文案解释「REQUIRED when CURSOR_LIST_SCOPE=local」+ 引用 SDK 错误信息 + `auto` / `claude-sonnet-4` / `gpt-5` 候选清单 + cloud-mode 退路。

**安全确认**：`.env.example` 仍含占位符 `CURSOR_API_KEY=crsr_REPLACE_WITH_YOUR_REAL_KEY_DO_NOT_EDIT_THIS_FILE`（QA-009 已锁定），diff 只显示 model 行的改动；`git diff codeflow-shell/.env.example | Select-String "crsr_[0-9a-f]"` = 0 匹配（QA HARD GATE 等价检查）。

### 2.4 `packages/codeflow-runtime/src/registry/__tests__/AgentSdkAdapter.test.ts`（**新文件**）

5 个测试覆盖 wire-through 全象限：

| 测试 | 场景 | 期望 |
|---|---|---|
| TS-MODEL-1 | `defaultModel="claude-sonnet-4"` + `spec.modelId` 不传 | `Agent.create` 收到 `model: { id: "claude-sonnet-4" }` |
| TS-MODEL-2 | `defaultModel="claude-sonnet-4"` + `spec.modelId="gpt-5"` | `Agent.create` 收到 `model: { id: "gpt-5" }`（spec 优先）|
| TS-MODEL-3 | 两者都不传 | `Agent.create` 收到 **无 `model` key**（regression guard：cloud auto-pick / local 在 send 阶段失败由 SDK 兜底，不变成"永远默认传"）|
| TS-MODEL-4 | `send()` 同样的 fallback：defaultModel 兜底 | `Agent.resume` 收到 `model: { id: "claude-sonnet-4" }` |
| TS-MODEL-5 | `send()` 同样的 spec 覆盖 | `Agent.resume` 收到 `model: { id: "gpt-5" }` |

**测试技术**：通过 monkey-patch `Agent.create` / `Agent.resume`（与 `PersistentStore.test.ts` 场景 10 monkey-patch `fs.rename` 同源做法），不引入 DI seam到生产代码。TS-MODEL-4/5 用一个 sentinel error `SEAM_TEST_HALT` 让 stub agent 的 `.send()` 立即抛错以避开真 `SdkRunHandle` 构造（不需要构造 SDKMessage-shape Run，对测试目的多余）。

### 2.5 `codeflow-shell/src/main.ts`（额外，第 7 项）

在 banner 第 5 行（"Cursor SDK : ..."）下方插入条件 WARNING 块：

```typescript
const listScope = cfg.cursor.listScope ?? "local";
const liveAdapterPicked = adapterDescription.startsWith("live ");
if (liveAdapterPicked && listScope === "local" && !cfg.cursor.defaultModel) {
  console.warn("WARNING        : live SDK + local mode + no CURSOR_DEFAULT_MODEL set.");
  console.warn("                 First task drop will fail with 'Local SDK agents");
  console.warn("                 require an explicit model.' Set CURSOR_DEFAULT_MODEL");
  console.warn("                 in ~/.codeflow/v2/.env (e.g. `auto`, `claude-sonnet-4`)");
  console.warn("                 or per-task `spec.modelId`. See README §Cursor API key.");
}
```

PM TASK-010 §四 #4 写「不强制 fail，让 ADMIN 看到友好提示」，这正是这块的语义 — 它**只警告，不退出**。即便用户不读 banner 而直接 drop 任务，第一次失败时 SDK 自己会抛同样的错误信息，所以不会 silent fail。

### 2.6 `codeflow-shell/README.md`

- 顶部 v0.2.0-beta 升 v0.2.0-beta.1，新加「What's new since v0.2.0-beta (P2)」节（4 个 🩹/🆕/✅ 行）。
- §"Whitelisted env vars" 表格 `CURSOR_DEFAULT_MODEL` 行从「Default model hint (recorded for forward compat — not yet wired through SDK calls)」改为详细 BUG-SDK-001 + 候选 model id + cloud-mode 退路说明。
- §"Quick start: getting a Cursor API key" 加 step 4「Local mode requires a default model」，明确两条出路（保持 `.env.example` 默认的 `auto` / 或切 cloud）+ 提示 banner WARNING 块的存在。
- step 2 把「starts with `ck_`」改为正确的「starts with `crsr_`」（QA-009 § A-07 也用的 crsr_ 前缀，旧文档遗留笔误）。

### 2.7 版本号同步

| 包 | 旧 | 新 |
|---|---|---|
| `codeflow-shell/package.json` | `0.2.0-beta` | `0.2.0-beta.1` |
| `codeflow-shell/src/main.ts` `VERSION` 字串 | `0.2.0-beta` | `0.2.0-beta.1` |
| `codeflow-shell/src/main.ts` file header doc | `v0.2.0-beta (P2)` | `v0.2.0-beta.1 (MT-1 hotfix on top of P2)` |
| `packages/codeflow-runtime/package.json` | `0.2.0-beta` | `0.2.0-beta.1` |

`@codeflow/protocol` 不动（schemas 仍 P4 才动）。

## §三 5 自测项实测结果

| # | 项 | 期望 | 实测 |
|---|---|---|---|
| 1 | `npx tsc --noEmit`（三包）| exit 0 | ✅ shell + runtime + protocol 三包全 0 错 |
| 2 | `npm test`（runtime）| 99 → 100+ pass，0 fail | ✅ **104/104 pass，0 fail，0 cancelled，duration ≈ 8.2s**；TS-MODEL-1..5 全过 |
| 3 | 设 `CURSOR_API_KEY=valid + CURSOR_DEFAULT_MODEL=auto` → npm start → drop sample-task → REVIEW decision ∈ {approved, ...}（非 needs_human） | banner `live` + 真 verdict | ⚠️ **代理通过**：DEV 无 ADMIN 真 key 不能直接验，但 self-test 4b（fake key + model="auto"）reproduced **新错误 path** `Agent.create failed for agent_id="DEV-01": Error (code=internal, isRetryable=false)` —— 与 QA-009 看到的 `agent.send failed ... Local SDK agents require an explicit model` **完全不同**：之前 fake key + 无 model SDK 根本没去解析 model 所以 create 成功，现在 wire-through 后 SDK 试解析 `model: { id: "auto" }` 触发真 model resolution → fake key 失败。这反向证明 model 真的传到 SDK 了。**最终 A-08/A-10 验证留 QA-011 用 ADMIN key 重跑**（PM §九-2 已计划）。 |
| 4 | 不设 model 仅设 key → banner WARNING 块 | 友好提示不强制 fail | ✅ self-test 4 (live + no model)：banner 输出 `WARNING        : live SDK + local mode + no CURSOR_DEFAULT_MODEL set.` 等 5 行；shell 不退出，照常进 governance loop（fake key 路径 register 不 fail，banner 后正常 running）|
| 5 | fake adapter（不设 key）→ 0 regression | governance loop 正常 | ✅ self-test 5（temp-rename `.env` 隔离 .env.project layer）：banner `fake (InMemorySdkAdapter)` ✅；drop sample-task → review 创建 `REVIEW-20260509-999-...md` ✅；NeedsHumanGate 触发（fake adapter 预期）✅；`grep EPERM` 空（MT-2 仍 active）✅；`.env` 已 restore ✅ |

### 关键 self-test 输出片段（已脱敏）

**Self-test 4（live + local + no model）**：

```text
> codeflow-shell@0.2.0-beta.1 start
> tsx src/main.ts
[SkillRegistry] loaded 3 skill(s) from C:\...\codeflow-mt1-w-XXX\skills
...
Cursor SDK     : live (CursorSdkAdapter; apiKey from config, listScope="local")
WARNING        : live SDK + local mode + no CURSOR_DEFAULT_MODEL set.
                 First task drop will fail with 'Local SDK agents
                 require an explicit model.' Set CURSOR_DEFAULT_MODEL
                 in ~/.codeflow/v2/.env (e.g. `auto`, `claude-sonnet-4`)
                 or per-task `spec.modelId`. See README §Cursor API key.
Skills loaded  : 3 (fcop, git, review)
...
Status         : running. Drop TASK-*-XXX-to-AGENT.md to inbox.
```

**Self-test 4b（live + local + model="auto" + fake key — wire-through 实证）**：

```text
[shell] fatal: Error: Agent.create failed for agent_id="DEV-01":
  Error (code=internal, isRetryable=false)
    at CursorSdkAdapter.create (.../AgentSdkAdapter.ts:198:15)
```

→ 关键点：**之前 fake key + 无 model 时 SDK 不真校验**（QA-009 P1 surprise S2 同源），**现在传了 `model: { id: "auto" }` SDK 立即去解析 → 立即发现 fake key 无效**。错误从 "send fail (require explicit model)" 变成 "create fail (internal error during model resolution)"，**说明 model 注入已生效**。ADMIN 用真 key 重跑就会跨过这个错误，完成完整 governance loop 拿到真 verdict。

**Self-test 5（fake adapter regression）**：

```text
Cursor SDK     : fake (InMemorySdkAdapter; CURSOR_API_KEY not set ...)
[NeedsHumanGate] human approval required: review_id="REVIEW-20260509-999-..."
  task_id="TASK-20260509-999-PM-to-DEV"  reviewer_role="REVIEW"
  trigger_reason="verdict_parse_failed"  ...
```

`reviews/REVIEW-20260509-999-REVIEW-on-TASK-20260509-999-PM-to-DEV.md` 创建 ✅。`grep EPERM` 空 ✅。

## §四 BUG-SDK-001 闭环判定

QA-009 §五 BUG-SDK-001 五要素核对：

| 字段 | QA 报告 | DEV-010 修复后状态 |
|---|---|---|
| Bug ID | BUG-SDK-001 | 由本 REPORT 关闭（pending QA-011 真 key 实证 A-08/A-10）|
| 严重度 | P1 | DEV side 已无代码缺陷；QA-011 通过即可降为 closed |
| 症状 | `[TaskDispatcher] startSession failed: agent.send failed ...: Local SDK agents require an explicit model.` | DEV self-test 4b 用 fake key 复现：错误 path 变化（create → SDK 内部 error），证明 model 已传；真 key 路径 DEV 无法实测（脱敏要求），交 QA-011 |
| 根因 | `AgentCreateSpec` / `AgentSendSpec` 未携带 model | `CursorSdkAdapterOptions.defaultModel` 字段 + create/send 双 fallback 链解决 |
| 影响范围 | v0.2 real SDK 路径完全失效 | 修复后：本地 wire-through 工作；fake adapter 路径 0 regression（self-test 5 验）|
| 是否影响 v0.1 基线 | 否 | 不变 |
| 修复路径 | "需 DEV 实现，约 60 行" | 实际 ~80 行（含 `defaultModel` JSDoc + main.ts WARNING 块 + 5 测试），全部覆盖|
| 临时规避 | `CURSOR_LIST_SCOPE=cloud` | 仍可用作 fallback；README §Whitelisted env vars 已写入 |

**判定**：DEV-side 修复完毕 + 单测覆盖。最终关闭权交 QA-011（用 ADMIN 真 key 跑 A-08/A-10）。

## §五 Surprises（3 个，无阻塞）

### S1 — Self-test 4b 的"反向证明"

**预期**：fake key 不应该到达 SDK 真验证逻辑（P1 报告 surprise S2 已观察 fake key 走得通）。

**观察**：传了 `model: { id: "auto" }` 之后，SDK **立即**去解析 model（这一步需要真 key），fake key 失败 → `Agent.create` 抛 `Error (code=internal, isRetryable=false)` 而不是返回 stub agent。

**含义**：实际上 cursor SDK 在 local mode 下并不是"完全不校验 fake key"，而是"在调用 Agent.create 不传 model 时延迟校验到 send；传 model 时立即校验"。这与 QA-009 P1 S2 观察一致 — fake key 在不传 model 时也确实走通过 create（因为 SDK 这时还没需要打到 cursor.com）。

**对本任务**：**正向**反向证明 — 我从 self-test 4b 的"新错误"信息证实 wire-through 起效（如果没起效，应该看到 P1 时的同样行为：create 成功 + 拿到 UUID）。

**建议处理**：无需 micro-task。下次更新 README 时可以加这段经验，方便 future debug。本 REPORT §四 self-test 实测节已记录。

### S2 — `codeflow-shell/.env` 在 self-test 5 干扰 fake-adapter regression

**观察**：自测 5 用 `Remove-Item Env:\CURSOR_API_KEY` 试图清空 process.env 来强 fake，但 `codeflow-shell/.env`（QA-009 留下的 ADMIN 真 key 文件，gitignored）在 ConfigLoader 第 4 层 `project-env` 被读入 → banner 仍显示 live。

**修复**：临时把 `codeflow-shell/.env` rename 成 `.env.tmp_selftest`，跑完再 rename 回。

**根因**：ConfigLoader 6 层优先级是 **defaults → user-config → project-config → user-env → project-env → process.env → CLI args**（最后覆盖前面）。理论上 `process.env` 应该胜过 `.env` —— 但「用 `Remove-Item Env:` 清空一个 var」不等于「process.env 显式写 empty string」，前者让 ConfigLoader 看不到这条 key 所以从 process.env 层 merge 不出值，落到 project-env 层的值生效。

**修复（不做）**：这是 ConfigLoader 的设计正确（当 process.env 没有某 var，项目级 .env 应继续生效，否则违背 6 层 fallback 语义）。**self-test 自身的策略问题**，已用 rename 绕过；REPORT 记录避免下次再撞。

**建议处理**：无 micro-task。Doc-only 改进可放到 P3+ README/troubleshooting 节。

### S3 — `RuntimeBootstrap` foreign 出现 14 个

**观察**：self-test 4b 的 Bootstrap 日志：

```text
[RuntimeBootstrap] ✅ 0 success / ⚠️ 0 failed / 🪦 0 orphaned / 👻 14 foreign
```

QA-009 §六 上报过 6~8 foreign，问 DEV 是否预期。

**DEV 分析**（直接看 `RuntimeBootstrap.ts:234-242`）：foreign = `Agent.list({ runtime: "local", cwd })` 返回的 `sdk_agent_id` 集合中、本地 `agents.json` **没记录**的那些。这些是历次跑 codeflow（每次 P1/P2 ADMIN 自测 + QA-009 验收 + 我的 4 次 self-test 4/4b/5 等）累计创建过的 SDK agents — Cursor SDK 在 cwd 里持久化它们的 `sdk_agent_id`，以后任何在同 cwd 的 `Agent.list({ runtime: "local", cwd })` 调用都会枚举到。RuntimeBootstrap 的 `IGNORE_FOREIGN` 策略对它们不做任何动作，只在 stdout 报数。

**结论**：**这是设计正确的行为，不是 bug**（QA-009 §六 提的 P2 surprise 可降级为 informational，不需修）。

**为什么数字会随时间增长**：每次 `Agent.create({ local: { cwd } })` 都创建一个新 sdk_agent_id 写到 cwd 内 SDK 自己的 metadata。我们的 `agents.json`（codeflow runtime 自己的视图）只跟踪当前 active 的 2 个 agents（DEV-01 + REVIEW-01），但 SDK 侧的累积是物理路径上的所有历次。

**减小这个数字的方法**（非本 sprint 范围）：
- 启动时显式调 `Agent.delete(foreignId)` 清理（可能误删别的进程的 agent）—— 风险高，不建议默认行为
- 加一条 `--purge-foreign` CLI flag（advance user 用），日常忽略

**建议处理**：在 README §Troubleshooting 加一段说明（doc-only），不动代码。本 sprint 不做。

## §六 Git status 清单（给 OPS）

DEV-01 MT-1 hotfix 完工后产出：

```
 M codeflow-shell/.env.example                                       ← uncomment CURSOR_DEFAULT_MODEL=auto + 升级文案
 M codeflow-shell/README.md                                          ← v0.2.0-beta.1 + What's new + step 4 model 提示
 M codeflow-shell/package.json                                       ← 0.2.0-beta → 0.2.0-beta.1 + description
 M codeflow-shell/src/main.ts                                        ← VERSION + WARNING block
 M codeflow-shell/src/sdk-factory.ts                                 ← 透传 cfg.defaultModel + JSDoc
 M packages/codeflow-runtime/package.json                            ← 0.2.0-beta → 0.2.0-beta.1 + description "104/104"
 M packages/codeflow-runtime/src/registry/AgentSdkAdapter.ts         ← defaultModel 字段 + create/send fallback
?? packages/codeflow-runtime/src/registry/__tests__/AgentSdkAdapter.test.ts  ← 新文件（5 测试）
```

**安全门 commit-time 检查**（OPS 必跑）：

```powershell
# 1. .env.example 必须只含 placeholder（无真 key 模式）
git diff codeflow-shell/.env.example | Select-String -Pattern 'crsr_[0-9a-f]{8,}|ck_[0-9a-f]{8,}|sk-[A-Za-z0-9]{20,}'
# 期望：0 匹配

# 2. 所有改动文件无真 key 泄露
git diff | Select-String -Pattern 'crsr_[0-9a-f]{8,}|ck_[0-9a-f]{8,}|sk-[A-Za-z0-9]{20,}'
# 期望：0 匹配
```

DEV 已自跑两条命令，0 匹配。

**OPS 不应 stage 的文件**（属于其它角色 scope）：

```
?? docs/agents/tasks/REPORT-20260510-005-PM-to-ADMIN.md   ← PM 自己 stage
?? docs/agents/tasks/REPORT-20260510-008-OPS-to-PM.md     ← OPS 自己 stage（之前 batch 漏 commit？建议本 commit 一起处理）
?? docs/agents/tasks/REPORT-20260510-009-QA-to-PM.md      ← QA 自己 stage（之前 batch 漏 commit？建议本 commit 一起处理）
?? docs/agents/tasks/TASK-20260510-010-PM-to-DEV.md       ← PM 自己 stage（本任务派单文件，建议本 commit 一起入 commit）
?? docs/agents/tasks/REPORT-20260510-010-DEV-to-PM.md     ← 本文件，OPS commit 时一并 stage
```

## §七 派 OPS（请 PM 转）

**派 OPS-01（建议 task_id `TASK-20260510-011-PM-to-OPS`）：**

1. `git add` §六 清单的 7 modified + 1 untracked test file + 本 REPORT 文件，commit message 建议：

   ```
   fix(v0.2.0-beta.1-mt1-hotfix): wire cfg.cursor.defaultModel into Agent.create / agent.send

   - codeflow-shell + @codeflow/runtime → 0.2.0-beta.1
   - CursorSdkAdapterOptions.defaultModel: spec.modelId ?? this._opts.defaultModel
     fallback chain in both create() and send(); closes BUG-SDK-001 (QA-009 §五).
   - sdk-factory.ts forwards cfg.defaultModel via spread (no behavioral change
     when defaultModel is undefined).
   - .env.example: uncomment CURSOR_DEFAULT_MODEL=auto + 16-line guidance block
     about local-mode model requirement.
   - main.ts: banner WARNING block when live + local + no defaultModel
     (friendly preflight; doesn't fail-fast — TASK §四 #4).
   - AgentSdkAdapter.test.ts: 5 new seam tests (TS-MODEL-1..5) via Agent.create
     /Agent.resume monkey-patch; runtime tests 99 → 104, 0 flakes.
   - README.md: Whitelisted env vars table + Quick start step 4 updated to
     mark CURSOR_DEFAULT_MODEL as required-in-local-mode.
   ```

2. 本地建 tag：`git tag v0.2.0-beta.1`（**不推 origin**，PM TASK-010 §六明令 + §五同政策）。

3. PM 可一并把 untracked 的 OPS-008 / QA-009 / PM-005 / TASK-010 / 本 REPORT 入此 commit，避免再单开 docs commit。

4. 验证命令（让 PM 一眼看到落地状态）：

   ```powershell
   git log --oneline -3
   git tag --list "v0.2.*"
   cd packages/codeflow-runtime && npm test 2>&1 | Select-String "tests|pass|fail" | Select-Object -First 3
   ```

   期望：tag 列出 `v0.2.0-alpha` + `v0.2.0-beta` + `v0.2.0-beta.1`；test `104 / 104 pass / 0 fail`。

5. **Commit-time 安全 HARD GATE**（必跑，stage 后 commit 前）：

   ```powershell
   git diff --cached | Select-String -Pattern 'crsr_[0-9a-f]{8,}|ck_[0-9a-f]{8,}|sk-[A-Za-z0-9]{20,}'
   ```

   期望：**0 匹配**。如果有匹配立即 `git restore --staged <file>` + alert PM/ADMIN。这是同 QA-009 §SAFETY 的等价检查，与 DEV-007 §五 S0 教训同源。

## §八 完工后链式效应（同 PM TASK-010 §九）

按 PM 计划，完工后链：

1. ✅ 本 REPORT 提交 → PM 派 OPS-011 commit + 本地 tag `v0.2.0-beta.1` （§七）
2. ⏭️ PM 派 QA-011 补跑 A-08/A-10 真 verdict 验收（DEV 不能直接做 — 脱敏边界）
3. ⏭️ **PM 派 DEV P3** (relay-bridge) — fcop@1.0 已落 PyPI，可同步开 P4 spike
4. ⏭️ PM 写 REPORT-PM-to-ADMIN「真 SDK 闭环 + 路线再加速」

DEV 自决约定：OPS-011 commit + tag 落地后 10 分钟内自动启动 P3 pre-analysis（读 `cfg.relay.*` 配置 + `server/relay/` v0.1 本地中继代码 + `docs/design/spike-v2-deploy.md`），不动手等 PM 派 P3 单。

## §九 SLA 实际

PM TASK-010 §八 限 ≤ 90 min，实际 ≈ 70 min（pre-analysis 5 min + 主交付 30 min + 测试 + self-test 25 min + REPORT 10 min）。0 BLOCKER。

DEV-01
2026-05-10 08:00 (UTC+8)
