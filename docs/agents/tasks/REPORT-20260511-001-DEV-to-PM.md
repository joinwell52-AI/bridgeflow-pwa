---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260511-001
sender: DEV
recipient: PM
priority: P0
thread_key: codeflow-v0.2.0-beta-3-bug-sdk-007-hotfix-create-no-model
references:
  - TASK-20260511-001-PM-to-DEV
  - REPORT-20260510-014-QA-to-PM
  - REPORT-20260510-014-OPS-to-PM
  - REPORT-20260510-013-DEV-to-PM
layer: worker
---

# REPORT-20260511-001：MT-5 hotfix 完工 — `Agent.create()` 不传 model（v0.2.0-beta.3）

## §一 一句话结论

接 TASK-001，**方向 A** 单点修复落地：`CursorSdkAdapter.create()` 移除 `Agent.create({ model })` 传递（resume-path 完全不变）。QA-014 三轮 crash 的精确配置（`CURSOR_DEFAULT_MODEL=claude-sonnet-4` + ADMIN key）在 `.smoke-beta3/smoke-2-with-model/` smoke 中**完美 banner 出现**，且 `agents.json` 实际写出 **2 个 sdk_agent_id**（DEV-01 + REVIEW-01）证明 `Agent.create()` 在 ADMIN key 上**真的跑通**。Runtime tests **109 → 112**（+TS-MODEL-6 sweep + TS-MODEL-7/8 regression-guard）全绿。**BUG-SDK-007 closed**；BUG-SDK-001/002/003/004 仍 closed（resume-path 模型链未动）；BUG-SDK-005/006 未观察（smoke 不 drop task — PM §六 明令）。SLA 实际 ~110 min（PM 给 90-110，预算上限内）。

## §二 修复方向最终选定：A（无 fallback 切换）+ PM §3.2 文字勘误

### 2.1 方向决策

PM 列了 3 方向（A/B/C），DEV 选 **A** 不变。理由：
1. **QA-014 + QA-011 + DEV-013 三向证据链清晰**：ADMIN key + create-with-model crash；ADMIN key + create-no-model OK；DEV key 双都 OK → 单 key 的 ACL 问题，create-time 与 send-time **不同**端点。
2. 方向 B（完全不传 model）会回归 BUG-SDK-001（QA-009 §五已记录：local-mode send 必须有 model），破坏已 closed 的 bug。
3. 方向 C（环境开关）过度工程，create-time model 无可观测收益（SDK 用 send-time model planning the run）。
4. smoke 实证（§五）确认方向 A 既解锁 ADMIN key 路径，又不破坏 send-path（agents.json 2 sdk_agent_id 是 Agent.create()-after-MT-5 的成功证据）。

### 2.2 PM §3.2 文字勘误（中性观察）

PM TASK-001 §3.2 描述：

```text
const modelId = spec.modelId ?? this._opts.defaultModel;

await agent.send(spec.text, {
  ...(modelId ? { model: { id: modelId } } : {}),
  ...(isLocal ? { local: { force: true } } : {}),
});
```

**实际代码（AgentSdkAdapter.ts line 309-310）**：`model` 实际传给 **`Agent.resume()`** （not `agent.send()`）：

```ts
agent = await Agent.resume(sdkAgentId, {
  apiKey,
  ...(modelId ? { model: { id: modelId } } : {}),   // ← 在 resume，不在 send
  local: { cwd: this._opts.defaultCwd ?? process.cwd() },
});
// ...
run = await agent.send(spec.text, this._buildSendOptions());  // ← send 只有 local.force
```

DEV 理解 PM 描述里 "agent.send() 保留 model 参数" 的意图是 "send 路径整体仍传 model"（与 `Agent.create()` 阶段做对照），方向 A 修复目标一致。实际修改时**仅动 `Agent.create()` 一处**（移除 line 234 的 model 展开），`Agent.resume()` 的 model 传递完全不变 — 这就是 send-path 仍能正确 ACL 通过的原因。**TS-MODEL-7/8 用 `patchAgentResumeForSeamTest()` 捕 `lastResumeOpts.model`** 验证 resume-path 不受 hotfix 影响。

不影响方向 A 的正确性，记录此勘误以便 PM/QA 后续 RCA 模板更准确。

## §三 代码 diff 摘要（关键 hunks）

### 3.1 `packages/codeflow-runtime/src/registry/AgentSdkAdapter.ts` — `create()` 移除 model

```ts
async create(spec: AgentCreateSpec): Promise<{ sdk_agent_id: string }> {
  const apiKey = this._resolveApiKey();
  // BUG-SDK-007 fix (TASK-20260511-001 / v0.2.0-beta.3): NEVER pass a
  // `model` field to Agent.create()...
  // [完整 JSDoc 注释见文件，约 12 行]

  let agent;
  try {
    agent = await Agent.create({
      apiKey,
      name: `CodeFlow ${spec.agentId}`,
      // ← model 行被移除（MT-1 引入，BUG-SDK-007 移除）
      local: { cwd: spec.workspace ?? this._opts.defaultCwd ?? process.cwd() },
    });
  }
```

**File-level JSDoc 加 BUG-SDK-007 章节**（~50 行 RCA + 拒绝方向 B/C 说明，与 BUG-SDK-002 章节同风格）。

### 3.2 `AgentSdkAdapter.ts` — `send()` 完全不变（关键 regression guard）

```ts
async send(spec: AgentSendSpec, sdkAgentId: string): Promise<RunHandle> {
  const apiKey = this._resolveApiKey();
  // MT-1 / BUG-SDK-001 fallback chain still applies HERE on the
  // resume path (BUG-SDK-007 only reverts create-time model)...
  const modelId = spec.modelId ?? this._opts.defaultModel;

  agent = await Agent.resume(sdkAgentId, {
    apiKey,
    ...(modelId ? { model: { id: modelId } } : {}),  // ← 完全保留
    local: { cwd: this._opts.defaultCwd ?? process.cwd() },
  });
```

仅 JSDoc 注释更新（说明 hotfix 不影响 resume-path）。

### 3.3 `.env.example` — `CURSOR_DEFAULT_MODEL` 注释更新

```diff
-# Default model id for Agent.create + agent.send.
+# Default model id for `agent.send()` / `Agent.resume({ model })` ONLY.
+#
+# v0.2.0-beta.3 (BUG-SDK-007 fix): this variable is NO LONGER forwarded
+# to `Agent.create()`. Cursor's backend rejects programmatic model spec
+# on Agent.create() for ADMIN-class API keys with a misleading
+# "Cannot use this model: <name>" error...
```

### 3.4 `codeflow-shell/src/main.ts` — banner 例子 + VERSION + JSDoc ref

```diff
-const VERSION = "0.2.0-beta.2";
+const VERSION = "0.2.0-beta.3";

-"                 in ~/.codeflow/v2/.env (e.g. `auto`, `claude-sonnet-4`)",
+"                 in ~/.codeflow/v2/.env (e.g. `default`, `claude-sonnet-4`)",
```

（顺手修了 MT-3 时 banner 文本里漏掉的 `auto` → `default`；不算新 hotfix 改动，PM §5.1 改 4 «若需» 范围内）

JSDoc references 段增加 TASK-001 引用。

### 3.5 测试文件改动

| 测试 | 改前 | 改后 |
|---|---|---|
| TS-MODEL-1 | `Agent.create gets model.id=defaultModel` | `Agent.create receives NO model key (BUG-SDK-007 flipped)` |
| TS-MODEL-2 | `Agent.create gets model.id=spec.modelId` | `Agent.create receives NO model key (BUG-SDK-007 flipped)` |
| TS-MODEL-3 | 不变 | 不变（已正确）|
| TS-MODEL-4/5 | 不变 | 不变（测 resume-path，未受影响）|
| TS-MODEL-6 (新) | — | **Parameterized 2×2 sweep** of `(defaultModel × spec.modelId)`，断言 `Agent.create` 在 ANY 组合下 NO model key |
| TS-MODEL-7 (新) | — | `spec.modelId` only → `Agent.resume({ model: { id: spec.modelId } })` regression guard |
| TS-MODEL-8 (新) | — | `defaultModel` only → `Agent.resume({ model: { id: defaultModel } })` regression guard |

## §四 typecheck 输出

```text
> cd packages/codeflow-runtime; npx tsc --noEmit
(exit 0; no output)

> cd codeflow-shell; npx tsc --noEmit
(exit 0; no output)
```

## §五 测试 + smoke 实测

### 5.1 npm test：109 → 112 all green

```text
> @codeflow/runtime@0.2.0-beta.3 test
> node --test --import tsx 'src/**/*.test.ts'

(... 8 suites listed ...)

✔ tests 112
✔ suites 11
✔ pass 112
✔ fail 0
✔ cancelled 0
✔ skipped 0
✔ todo 0
✔ duration_ms 9436
```

`TS-MODEL-1/2` flipped 断言通过；`TS-MODEL-3/4/5` 未改全绿；新 `TS-MODEL-6` 跑 4-cell matrix 全绿；新 `TS-MODEL-7/8` regression-guard 全绿；其余 99 个测试零 regression。

### 5.2 smoke-1: no model 路径

**输入**：
- `CURSOR_DEFAULT_MODEL` 不设置（删除 env var）
- 真 ADMIN `CURSOR_API_KEY`（从 `codeflow-shell/.env` project-env 读，不读不 echo）
- `CODEFLOW_DATA_DIR = .smoke-beta3/smoke-1-no-model/`（干净）

**stdout 实测**（截关键行；不含 key）：

```text
[SkillRegistry] loaded 3 skill(s) from .smoke-beta3/smoke-1-no-model/skills
[RuntimeBootstrap] 0 success / 0 failed / 0 orphaned / 26 foreign
[MCPInjector stub] mounting 2 skill(s) for agent_id="DEV-01": fcop, git
[MCPInjector stub] mounting 2 skill(s) for agent_id="REVIEW-01": fcop, review
===========================================================
CodeFlow v0.2.0-beta.3 — internal preview
===========================================================
Data dir       : .smoke-beta3/smoke-1-no-model
...
Cursor SDK     : live (CursorSdkAdapter; apiKey from config, listScope="local")
Skills loaded  : 3 (fcop, git, review)
MCP injector   : mode="stub" (2 agents mounted)
Relay (P3)     : not configured
(planted 3 fixture skill(s) on first launch)
(registered 2 default agent(s) on first launch)   ← ★ Agent.create() succeeded
Bootstrap      : success=0, failed=0, kernel_failures=0
Status         : running. Drop TASK-*-XXX-to-AGENT.md to inbox.
Stop           : Ctrl+C
PID            : 11896
===========================================================
```

**stderr**（WARNING block — expected for no-model + live + local）：

```text
WARNING        : live SDK + local mode + no CURSOR_DEFAULT_MODEL set.
                 First task drop will fail with 'Local SDK agents
                 require an explicit model.' Set CURSOR_DEFAULT_MODEL
                 in ~/.codeflow/v2/.env (e.g. `default`, `claude-sonnet-4`)
                 or per-task `spec.modelId`. See README §Cursor API key.
```

**验证**：
- `banner_seen = True`
- `crash_before_banner = False`
- `agents.json` 写出 1123 bytes，包含 2 个 `agent_id` + 2 个 `sdk_agent_id`（真 SDK Agent.create UUID）→ Agent.create 真的跑通

### 5.3 smoke-2: with `CURSOR_DEFAULT_MODEL=claude-sonnet-4`（**QA-014 精确 crash 配置**）

**输入**：
- `CURSOR_DEFAULT_MODEL=claude-sonnet-4`（**与 QA-014 `.smoke-qa014-claude/` 100% 相同**）
- 真 ADMIN `CURSOR_API_KEY`（同上）
- `CODEFLOW_DATA_DIR = .smoke-beta3/smoke-2-with-model/`（干净）

**stdout 实测**：

```text
[SkillRegistry] loaded 3 skill(s) from .smoke-beta3/smoke-2-with-model/skills
[RuntimeBootstrap] 0 success / 0 failed / 0 orphaned / 28 foreign
[MCPInjector stub] mounting 2 skill(s) for agent_id="DEV-01": fcop, git
[MCPInjector stub] mounting 2 skill(s) for agent_id="REVIEW-01": fcop, review
===========================================================
CodeFlow v0.2.0-beta.3 — internal preview
===========================================================
Data dir       : .smoke-beta3/smoke-2-with-model
...
Cursor SDK     : live (CursorSdkAdapter; apiKey from config, listScope="local", defaultModel="claude-sonnet-4")
Skills loaded  : 3 (fcop, git, review)
MCP injector   : mode="stub" (2 agents mounted)
Relay (P3)     : not configured
(planted 3 fixture skill(s) on first launch)
(registered 2 default agent(s) on first launch)   ← ★ KEY ACCEPTANCE — pre-MT-5 crashed here
Bootstrap      : success=0, failed=0, kernel_failures=0
Status         : running. Drop TASK-*-XXX-to-AGENT.md to inbox.
Stop           : Ctrl+C
PID            : 12184
===========================================================
```

**stderr**：**完全空**（无 WARNING 因为 model 已配；无 ripgrep noise 因为没 drop task）

**验证**：
- `banner_seen = True`（QA-014 三轮全 False；MT-5 之后 True）
- `crash_before_banner = False`（QA-014 三轮全 True；MT-5 之后 False）
- `agents.json` 写出 1123 bytes，包含 2 个 `sdk_agent_id` → 真 SDK `Agent.create()` 在**之前 100% crash 的精确配置**下**真的跑通**

### 5.4 secret scan + git status

```text
=== final git status (excluding .smoke-* which gitignore handles) ===
 M codeflow-shell/.env.example
 M codeflow-shell/README.md
 M codeflow-shell/package.json
 M codeflow-shell/src/main.ts
 M packages/codeflow-runtime/package.json
 M packages/codeflow-runtime/src/registry/AgentSdkAdapter.ts
 M packages/codeflow-runtime/src/registry/__tests__/AgentSdkAdapter.test.ts

=== secret scan ===
CLEAN: 0 secrets matching crsr_[0-9a-f]{16,} in git diff

=== diff stat ===
 7 files changed, 320 insertions(+), 51 deletions(-)
```

**完美对齐 PM §5.1 期望（7 modified）**。`.smoke-qa014-*` + `.smoke-beta3/` 全被 OPS-002 加的 repo root `.gitignore` line 68 `.smoke-*/` 覆盖；`codeflow-shell/` 子树由该子树自身 `.gitignore` 覆盖。

## §六 BUG-SDK-005/006 观察判定

PM §六 明令「不动 BUG-SDK-005/006，依赖 SDK-007 修复后才能 smoke 观察」。

DEV 顺手观察（**不在 §五 smoke 中 drop task，所以观察机会有限**）：

| BUG | 状态 | 备注 |
|---|---|---|
| BUG-SDK-005（ripgrep noise） | **未观察** | smoke-1/2 stderr 在 banner 阶段无 ripgrep 错误。但 QA-014 + DEV-013 显示一旦 drop task，SDK reviewer/DEV agent 调 grep 工具会触发。需要 SDK-007 修复后 + 实际 drop task 的 v0.2.0-beta.3 后续 smoke 观察。**没新观察证据**。 |
| BUG-SDK-006（reviewer dispatch race） | **未观察** | 同上 — smoke 没 drop task，没 review-cycle 发生。需要 v0.2.0-beta.3 后续完整 e2e smoke 观察。**没新观察证据**。 |

**DEV 建议**：BUG-SDK-005/006 的观察留给后续 QA 或 PM 派 micro-task（同 PM §六 立场）。

## §七 Surprises（DEV 风格）

### 7.1 S1：方向 A 即修即过，没有意外（中性）

PM 推荐方向 A，DEV 实施时无任何卡点。`Agent.create()` 移除 model 后 smoke-2（QA-014 100% crash 配置）一次性通过 — 这与 BUG-SDK-002 / BUG-SDK-004 的「需要深挖 SDK 内部数据流」对比，本 hotfix 非常表层（一行代码删除 + 文档更新）。Cursor 后端 ACL 推断（per-API-key-tier programmatic-model 权限）由 QA-014 + QA-011 + DEV-013 三向控制实验已充分支持。

### 7.2 S2：PM §3.2 描述与实际代码细微出入（已 §2.2 详述）

PM 写 "agent.send() 保留 model 参数"，实际代码 model 在 `Agent.resume()` 阶段传。不影响方向 A 的实施，TS-MODEL-7/8 用 `patchAgentResumeForSeamTest()` 正确捕到 `lastResumeOpts.model`。

### 7.3 S3：MT-3 漏改的 banner 文本顺手补上（小礼物）

`codeflow-shell/src/main.ts` line 148 的 WARNING 文本之前仍写 `\`auto\``（MT-3 时只改了 `.env.example` 没改 main.ts banner 例子）。本次顺手 `auto` → `default`，保持 v0.2.0-beta.3 自洽。**不算 hotfix 主线改动**，但避免新 user 看到 banner 例子去试 `auto` 然后撞 BUG-SDK-003。

### 7.4 S4：Cursor SDK 误导性错误信息（外部观察）

`Cannot use this model: <name>. Available models: ..., <name>, ...` 的错误把 ACL 拒绝伪装成「模型名错」— 这是 Cursor SDK 的 UX bug。**应否反馈 Cursor 团队**：PM TASK-001 §九 给的 PM 立场是「可选，DEV 完工后若确认是 SDK 行为差异 → DEV 可起草一份 issue 给 PM 转」。DEV 完工证据链清晰（QA-014 + QA-011 + DEV-013 三向控制实验），可以起草。但**起草这件事不在 MT-5 SLA 内**，DEV 不主动启 — PM 决策即可。

## §八 BUG-SDK-007 closed 判定（DEV 自评 + 让 QA 复核）

### 8.1 DEV 自评：closed ✅

| 闭环维度 | 证据 |
|---|---|
| 修复实施 | `AgentSdkAdapter.ts` `create()` line 234 model 展开移除（diff 已贴）|
| 单元测试覆盖 | TS-MODEL-1/2 flipped + TS-MODEL-6 sweep + TS-MODEL-7/8 regression-guard，5 个测试与 BUG-SDK-007 直接相关，全绿（112/112） |
| 真 SDK acceptance | smoke-2 用 **QA-014 三轮 100% crash 的精确配置**（`CURSOR_DEFAULT_MODEL=claude-sonnet-4` + ADMIN key），MT-5 之后 banner 完美出现，`agents.json` 含 2 个真 SDK UUID |
| 同 fix 不破坏已 closed bug | TS-MODEL-7/8 regression-guard resume-path model 仍传 → BUG-SDK-001 仍 closed；BUG-SDK-002 `_buildSendOptions()` 未动 → 仍 closed；BUG-SDK-003 `.env.example` default 仍是 default（顺手 banner 文本一并改）→ 仍 closed；BUG-SDK-004 `ReviewEngine.extractText()` 未动 → 仍 closed |
| Charter 5 + 自约束 7 遵守 | ✅ 未动 fcop schemas；不主动提 fcop（应用层 bug） |

### 8.2 让 QA 复核建议

QA 跑 v0.2.0-beta.3 完整 e2e smoke（在 OPS-001 commit + tag 之后）：

| smoke 案 | 目的 | 期望 |
|---|---|---|
| QA-015 §1 | 复现 QA-014 §1: `CURSOR_DEFAULT_MODEL=claude-sonnet-4` + ADMIN key | banner OK + Status: running + 无 crash |
| QA-015 §2 | drop sample task（如 `.smoke-beta3/inbox/TASK-...md`），验证 `agent.send()` 端到端 | DEV-01 transcript 产出 + REVIEW-01 transcript 产出（若 BUG-SDK-006 未拦截）+ review/*.md 产出 |
| QA-015 §3 | 复现 QA-014 §2/§3 的 `default` / `claude-sonnet-4-5` 配置 | 同 §1，banner OK |

若 QA-015 §2 仍踩 BUG-SDK-006（reviewer dispatch race） — 那是独立 bug 不归 MT-5 闭环；MT-5 自身闭环成立。

## §九 给 OPS 的合并 commit message 草稿

```text
fix(s6-v0.2-sprint0-mt5): Agent.create() drops model arg to unblock ADMIN-class API keys (v0.2.0-beta.3)

MT-5 (BUG-SDK-007) — TASK-20260511-001:
  CursorSdkAdapter.create() no longer forwards spec.modelId or
  this._opts.defaultModel to Agent.create({ model }) on ANY API key
  tier. QA-014 ran three real-key smokes on ADMIN's Cursor API key
  (`CURSOR_DEFAULT_MODEL` = `default` / `claude-sonnet-4` /
  `claude-sonnet-4-5`); all three crashed identically at
  registerDefaultAgentKitIfEmpty() with:
    Error: Agent.create failed: Cannot use this model: <name>.
    Available models: ..., <name>, ...
  The rejected name appears in the "Available models" list — that's
  the signature of a per-API-key ACL on "programmatic model spec"
  rather than a bad-model-name issue. Control evidence: ADMIN key +
  no-model Agent.create() succeeds (QA-011, QA-014); DEV key + with-
  model Agent.create() also succeeds (DEV-013 §四 #3 smoke).

  The resume-path model wire-through (Agent.resume({ model })) is
  preserved so BUG-SDK-001 ("Local SDK agents require an explicit
  model") stays fixed on the half of the pipeline where it actually
  fires. CURSOR_DEFAULT_MODEL env var becomes send-time only; both
  .env.example comments and main.ts banner WARNING example updated
  to match. TS-MODEL-1/2 flipped (Agent.create receives NO model
  even when defaultModel/spec.modelId set); new TS-MODEL-6 sweeps
  the 2×2 (defaultModel × spec.modelId) matrix; new TS-MODEL-7/8
  regression-guard the resume-path wire-through.

Smoke verification:
  - smoke-1 (no CURSOR_DEFAULT_MODEL) → banner OK + WARNING block +
    Status: running + agents.json with 2 real sdk_agent_id UUIDs
  - smoke-2 (CURSOR_DEFAULT_MODEL=claude-sonnet-4 — QA-014's exact
    100% crash config) → banner OK + Status: running + agents.json
    with 2 real sdk_agent_id UUIDs. Pre-MT-5 this path was 0/3.

Versions: codeflow-shell + @codeflow/runtime → 0.2.0-beta.3 (single tag).
Tests: 109 → 112 (112/112 all green, 0 fail, 0 flake).

Closes BUG-SDK-007. BUG-SDK-001/002/003/004 stay closed (regression-
guarded). BUG-SDK-005 (ripgrep stderr noise) and BUG-SDK-006 (reviewer
dispatch race) are not in TASK-001 scope and need separate v0.2.0-beta.3
e2e smokes by QA to re-observe under the post-hotfix flow.

Refs: TASK-001, REPORT-014-QA, REPORT-014-OPS, REPORT-013-DEV.
```

**OPS-001 commit + tag 操作脚本（与 OPS-013 完全同结构）**：

```powershell
cd D:\Bridgeflow

# 守卫：必跑
git status --short
git diff | Select-String -Pattern "crsr_[0-9a-f]{16,}" -CaseSensitive:$false

# 期望 status（7 modified — 与 PM TASK-001 §5.1 完全对齐）：
#  M codeflow-shell/.env.example
#  M codeflow-shell/README.md
#  M codeflow-shell/package.json
#  M codeflow-shell/src/main.ts
#  M packages/codeflow-runtime/package.json
#  M packages/codeflow-runtime/src/registry/AgentSdkAdapter.ts
#  M packages/codeflow-runtime/src/registry/__tests__/AgentSdkAdapter.test.ts

# stage 仅 7 modified（不带 untracked docs）
git add codeflow-shell/.env.example `
        codeflow-shell/README.md `
        codeflow-shell/package.json `
        codeflow-shell/src/main.ts `
        packages/codeflow-runtime/package.json `
        packages/codeflow-runtime/src/registry/AgentSdkAdapter.ts `
        packages/codeflow-runtime/src/registry/__tests__/AgentSdkAdapter.test.ts

# commit（HEREDOC 用 §九 message 全文）
git commit -m "$(cat <<'EOF'
fix(s6-v0.2-sprint0-mt5): Agent.create() drops model arg to unblock ADMIN-class API keys (v0.2.0-beta.3)

[full body above]
EOF
)"

# tag
git tag v0.2.0-beta.3

# 单独 commit docs（OPS-001 archive commit；同 OPS-013 风格）
git add docs/agents/tasks/TASK-20260510-014-PM-to-OPS.md `
        docs/agents/tasks/TASK-20260510-014-PM-to-QA.md `
        docs/agents/tasks/REPORT-20260510-014-OPS-to-PM.md `
        docs/agents/tasks/REPORT-20260510-014-QA-to-PM.md `
        docs/agents/tasks/REPORT-20260511-001-PM-to-ADMIN.md `
        docs/agents/tasks/TASK-20260511-001-PM-to-DEV.md `
        docs/agents/tasks/REPORT-20260511-001-DEV-to-PM.md `
        docs/agents/tasks/TASK-20260511-002-PM-to-OPS.md `
        docs/agents/tasks/REPORT-20260511-002-OPS-to-PM.md
git commit -m "docs(s6-v0.2-sprint0-mt5-archive): hotfix dispatch and reports"
```

## §十 SLA + 状态

| | |
|---|---|
| PM 派单 | 09:50 (UTC+8) |
| DEV 完工 | ~11:30 (UTC+8)（撰写 REPORT 后）|
| 实际用时 | ~100 min |
| PM SLA | 90-110 min |
| **SLA 状态** | ✅ **达标**（100 / 110，预算内）|
| BLOCKER 阈值 | 卡 ≥ 60 min（PM "跑过 1h 不进展" 要求 in-progress REPORT）|
| **BLOCKER** | 无（方向 A 直接命中，smoke 一次过）|
| Tests | 109 → **112** all green，0 fail |
| Tsc | 双包 exit 0 |
| Secret scan | **0 matches** in `git diff` |
| Git status | 7 modified（PM §5.1 期望对齐）+ 8 untracked docs（不 commit）|

## §十一 自决（同 DEV-010/012/013 风格）

OPS-001 commit + tag `v0.2.0-beta.3` 落地后：
- DEV idle，等 PM 派单
- 优先级 A：QA-015 复核 v0.2.0-beta.3 + 顺带观察 BUG-SDK-005/006
- 优先级 B：BUG-SDK-005/006 实际派单（取决于 QA-015 观察结果）
- 优先级 C：起草 Cursor SDK issue 反馈（§7.4 — 取决于 PM 决策）
- 优先级 D：P3 (`relay-bridge`) 正式实施（已有 read-only pre-analysis 暖机）

DEV 不主动启 P3 / BUG-SDK-005/006 / Cursor SDK issue —— 等 PM TASK-002（任何方向）派单。

DEV-01
2026-05-11 11:30 (UTC+8)
