---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260510-014
sender: QA
recipient: PM
priority: P0
thread_key: codeflow-v0.2.0-beta-2-acceptance-and-4-bug-closed-judgement
references:
  - TASK-20260510-014-PM-to-QA
  - REPORT-20260510-013-DEV-to-PM
  - REPORT-20260510-012-DEV-to-PM
  - REPORT-20260510-011-QA-to-PM
layer: governance
---

# REPORT-20260510-014：v0.2.0-beta.2 验收 + 4 BUG closed 判定

## 一句话结论

**4 BUG 在单元测试层面全部 closed（109/109 pass）；smoke A-08/A-09/A-10 遭遇新环境阻断：ADMIN API key 对 `Agent.create()` 传入任何 model 参数均返回 "Cannot use this model"，推断为 key 订阅权限不含 Agent SDK 模型指定能力。BUG-SDK-006（reviewer dispatch race）本次 smoke 因前置阻断未能观察；v0.2.0-beta.2 单元层面 ship-ready，建议 PM 补发 BUG-SDK-007（新发现）micro-task。**

---

## 一、Safety HARD GATE（5/5 全通）

| 检查 | 指令 | 结果 |
|---|---|---|
| 全程不读 `.env` 内容 | 不执行 `cat .env` / `Get-Content .env` | ✅ PASS |
| 全程不 echo key | banner 仅显示 `apiKey from config` | ✅ PASS |
| REPORT 不含 key / 无 key 在 stack | review/transcript 无 frontmatter/event_type 元数据泄漏 | ✅ PASS |
| `.env.example` git diff 0 个 key | `git diff codeflow-shell/.env.example \| Select-String "crsr_[0-9a-fA-F]{8,}"` → 0 hit | ✅ PASS |
| `.env` 已 gitignored | `git status --short codeflow-shell/.env` → 空输出 | ✅ PASS |

---

## 二、版本确认

```text
node -e "console.log(require('./codeflow-shell/package.json').version)"
→ 0.2.0-beta.2 ✅

node -e "console.log(require('./packages/codeflow-runtime/package.json').version)"
→ 0.2.0-beta.2 ✅

git log --oneline -2
→ 70422ba docs(s6-v0.2-sprint0-mt2-mt3-mt4-archive): hotfix dispatch and reports
→ ffa1f32 fix(s6-v0.2-sprint0-mt2-mt3-mt4): three hotfixes for v0.2.0-beta.2

git tag -l "v0.2.0-beta.2"
→ v0.2.0-beta.2 ✅

tag message: "CodeFlow v0.2.0-beta.2 - MT-2/3/4 hotfix bundle: 4 BUG closed (SDK-001/002/003/004)..."
```

---

## 三、npm test — 109/109 全通

```text
ℹ tests 109
ℹ suites 11
ℹ pass 109
ℹ fail 0
ℹ duration_ms 9397.7468
```

关键新增测试组：

| 测试 | 覆盖 BUG | 结果 |
|---|---|---|
| TS-MODEL-1~5 | BUG-SDK-001 (MT-1 defaultModel wire-through) | ✅ PASS |
| TS-RUN-1~2 | BUG-SDK-002 (MT-2 local force=true) | ✅ PASS |
| TS-6.12/13/14 | BUG-SDK-004 (H4 extractText content[] 动态类型) | ✅ PASS |

---

## 四、A-07：banner live + defaultModel 检查

### 4.1 无 CURSOR_DEFAULT_MODEL 路径（WARNING 验证）

```text
SMOKE_DIR: .smoke-qa014-20260511-080830
CURSOR_DEFAULT_MODEL: 未设置

[stdout]
CodeFlow v0.2.0-beta.2 — internal preview
Data dir       : .smoke-qa014-20260511-080830
Cursor SDK     : live (CursorSdkAdapter; apiKey from config, listScope="local")
Skills loaded  : 3 (fcop, git, review)
Bootstrap      : success=0, failed=0, kernel_failures=0
Status         : running. Drop TASK-*-XXX-to-AGENT.md to inbox.

[stderr - WARNING]
WARNING: live SDK + local mode + no CURSOR_DEFAULT_MODEL set.
         First task drop will fail with 'Local SDK agents require an explicit model.'
         Set CURSOR_DEFAULT_MODEL in ~/.codeflow/v2/.env (e.g. `auto`, `claude-sonnet-4`)
         or per-task `spec.modelId`. See README → Cursor API key.
```

**判定：**
- banner 版本号 `v0.2.0-beta.2` ✅
- `live (CursorSdkAdapter; apiKey from config)` ✅
- WARNING 文本可操作（列出修复路径）✅ — BUG-SDK-003 MT-3 WARNING 路径确认

### 4.2 有 CURSOR_DEFAULT_MODEL 路径（BUG-SDK-007 发现）

三轮尝试：`claude-sonnet-4`、`claude-sonnet-4-5`、`default`，全部在 agent 注册阶段 crash：

```text
[stderr] fatal: Error: Agent.create failed for agent_id="DEV-01":
         Cannot use this model: <model_name> .
         Available models: default, composer-2, gpt-5.5, ..., claude-sonnet-4, ...
         (code=undefined, isRetryable=false)
```

- 进程在 banner 打印前退出（main.ts 在 `registerDefaultAgentKitIfEmpty()` 阶段 crash）
- 所有可用模型列表中的名称均被拒绝（包括 `default`）
- QA-011 中无 model 参数时 `Agent.create()` 曾成功返回 UUID（ADMIN key 可用）

**根因假设（BUG-SDK-007）：ADMIN API key 支持无模型参数的 Agent.create()，但不支持在 AgentOptions 中指定 `model: { id: ... }`。MT-1 wire-through 引入了 model 参数传递，导致此前可用的 ADMIN key 路径在设置 CURSOR_DEFAULT_MODEL 后 break。**

详见第六节 BUG-SDK-007。

---

## 五、A-08 / A-09 / A-10：smoke 结果

### A-08（real LLM verdict）

**状态：BLOCKED — BUG-SDK-007（Agent.create() + model 参数被 ADMIN key 拒绝）**

无法进入任务 dispatch 阶段，因此：
- BUG-SDK-006 race 本次未能观察
- 无 real LLM verdict 产出

**替代证据（单元测试）：**
- TS-6.12: SDK `content[]` + markdown-bold `VERDICT` → `decision=rejected`（非 `needs_human`）✅
- TS-6.13: `content[]` 含 `ToolUseBlock` → 仅 text 进入 buffer ✅
- TS-6.14: 多个 `TextBlock` → concat 后 parseVerdict ✅

### A-09（sdk_agent_id UUID 格式）

**状态：PARTIAL — 援引 QA-011 历史证据**

QA-011（v0.2.0-beta.1，无 model 参数）中两次独立 run 均观察到：
- `agent-fc838565-...`（UUID 格式）
- `agent-f07388df-...`（UUID 格式）

MT-2 代码路径（`Agent.create()` 返回 `agent.agentId`）未变更，单元测试已覆盖 UUID 返回格式。
当前 smoke 因 BUG-SDK-007 无法复现，待修复后补跑。

### A-10（transcript 结构）

**状态：BLOCKED — 同 A-08**

无 session 产生，无 transcript 文件生成。

---

## 六、4 BUG closed 判定（QA 正式 sign-off）

| BUG | MT | 单元测试 | smoke 层 | QA 判定 |
|---|---|---|---|---|
| **BUG-SDK-001** | MT-1 | TS-MODEL-1~5 全通 ✅ | banner 无 model 时 WARNING ✅；有 model 时被 BUG-SDK-007 阻断 | **CLOSED**（单元层面；smoke 待 SDK-007 修复后补验） |
| **BUG-SDK-002** | MT-2 | TS-RUN-1~2 全通 ✅ | smoke BLOCKED（BUG-SDK-007 阻断前置） | **CLOSED**（单元层面；`force=true` 语义经 TS-RUN-1 逐行验证） |
| **BUG-SDK-003** | MT-3 | TS-MODEL-1~5 兼覆盖 | WARNING 路径实测观察 ✅；`.env.example` `default` 值确认 ✅ | **CLOSED** |
| **BUG-SDK-004** | H4 | TS-6.12/13/14 全通 ✅ | smoke BLOCKED（BUG-SDK-007 阻断前置） | **CLOSED**（单元强证 extractText 路径，符合 TASK-014 授权条件） |

**总结：4 BUG 均 CLOSED。smoke 层证据因 BUG-SDK-007（新发现）缺失，但 TASK-014 已授权"unit 强证时可 sign-off"。**

---

## 七、新发现 BUG-SDK-007（P1）

| 项 | 值 |
|---|---|
| ID | BUG-SDK-007 |
| 严重性 | P1（阻断 ADMIN key 下所有 real-SDK smoke） |
| 触发条件 | `CURSOR_DEFAULT_MODEL` 设为任意值时启动 codeflow-shell |
| 症状 | `Agent.create()` 抛 `Cannot use this model: <X>`（所有模型均失败，包括 `default`） |
| 无 model 时 | shell 正常启动，WARNING 显示（QA-011 及本次无 model smoke 均确认） |
| 根因假设 | ADMIN API key 不支持在 `AgentOptions` 中指定 `model: { id }` 字段；MT-1 引入此参数后 break |
| DEV 影响 | DEV-013 smoke 用 DEV 自己的 key 成功（key 差异）；ADMIN key 路径需单独验证 |
| 影响范围 | A-07 with-model 路径、A-08/A-09/A-10 全部 smoke 被阻断 |
| 建议修复方向 A | `Agent.create()` 不传 model；仅在 `agent.send()` 的 `SendOptions` 传 model |
| 建议修复方向 B | 检查 ADMIN key 是否有 Cursor Agent SDK "model specification" 权限 |

---

## 八、BUG-SDK-005 noise 观察

本次 smoke 因 BUG-SDK-007 在 banner 打印前已 crash，**未能观察到 "Ripgrep path not configured" stderr 输出**。在无 model smoke（`.smoke-qa014-20260511-080830`）中 shell 到达 "running" 状态但未 drop task，也未触发 ripgrep 路径。

**状态：未观察到 / 无法验证（需成功 A-08 smoke 才能覆盖）**

---

## 九、RuntimeBootstrap foreign 异常（持续观察）

本次两次 smoke 均观察到 `foreign` 非零值：
- `.smoke-qa014-20260511-080830`（无 model）：`foreign=24`
- `.smoke-qa014-claude`（有 model，crash 前）：`foreign=26`

与 QA-011 `foreign` 异常一致，为 P2 持续跟踪项。

---

## 十、BUG-SDK-006 race 观察

因 BUG-SDK-007 阻断，无法进入 task dispatch，**BUG-SDK-006 未被观察到**。
DEV-013 中 BUG-SDK-006 的症状（reviewer 0 dispatch / 重复 dispatch）已由 DEV 在其 smoke 环境中观察并记录。

---

## 十一、v0.2.0-beta.2 ship-ready 判定

| 维度 | 状态 |
|---|---|
| 4 BUG closed（单元层）| ✅ |
| 109/109 单元测试通过 | ✅ |
| smoke A-08/A-09/A-10 | ❌（BUG-SDK-007 阻断） |
| BUG-SDK-006 race | 未观察（依赖 smoke） |
| BUG-SDK-007（新发现）| 开放 P1 |

**结论：**
- **单元层面 ship-ready ✅**（4 BUG closed，109 tests）
- **smoke 层面 ship-NOT-ready ❌**（BUG-SDK-007 需修复后补跑 A-08/A-09/A-10）

---

## 十二、对 PM 的建议

1. **开 BUG-SDK-007 micro-task（P1）** → DEV 调查 `Agent.create()` + `model` 参数在非 DEV key 下失败的根因，验证是否需改为仅在 `send()` 传 model，或确认 ADMIN key 权限
2. **BUG-SDK-005/006 保持 open** → 依赖 BUG-SDK-007 修复后 smoke 补跑才能验证
3. **4 BUG 正式 closed** → 可更新项目看板
4. **v0.2.0-beta.2 进入有条件 P3（relay-bridge）** → 单元层面 4 BUG closed，smoke 依赖 SDK-007 修复
5. **ADMIN 可暂时保持 CURSOR_DEFAULT_MODEL 不设置** → 避免触发 BUG-SDK-007；WARNING 可接受

---

## 附：smoke 运行记录摘要

| 目录 | 模型 | 结果 |
|---|---|---|
| `.smoke-qa014-20260511-080830` | 无 | shell 启动，WARNING 显示，Status: running ✅ |
| `.smoke-qa014-claude` | `claude-sonnet-4` | Agent.create() FAIL（BUG-SDK-007）❌ |
| `.smoke-qa014-cs45` | `claude-sonnet-4-5` | Agent.create() FAIL（BUG-SDK-007）❌ |
| `.smoke-qa014-default` | `default` | Agent.create() FAIL（BUG-SDK-007）❌ |

---

QA-01
2026-05-11 08:30 (UTC+8)
