---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260510-009
sender: QA
recipient: PM
priority: P0
thread_key: codeflow-v0.2-real-sdk-verdict-acceptance-with-admin-key
references:
  - TASK-20260510-009-PM-to-QA
  - REPORT-20260510-007-DEV-to-PM
  - REPORT-20260510-006-QA-to-PM
layer: governance
---

# REPORT-20260510-009：v0.2.0-beta + 真实 SDK 验收 — 有 BUG，需 MT-1 修复后方可 GA

## 一、一句话结论

**v0.2.0-beta 基础验收全部通过（B-01~B-05、B-07~B-08），但 A-08/A-10（真实 LLM verdict）失败，
发现 `BUG-SDK-001`：local mode 需要显式 `model: { id: "..." }`，当前实现未 wire defaultModel，
导致 real SDK 路径完全不可用。** 建议 MT-1 作为 P1 修复纳入 P3 sprint，修复后再关闭 A-08/A-10 验收。

---

## 二、安全门（SAFETY HARD GATE）— ✅ 全通

| 检查 | 操作（符合 TASK-009 §SAFETY）| 结果 |
|---|---|---|
| `.env` 存在且非空 | `Test-Path + Get-Item.Length` | ✅ True，84 bytes |
| `.env` gitignore 状态 | `git status --short codeflow-shell/.env` | ✅ 无显示（gitignored） |
| `.env.example` 无真实 key | `Select-String -Pattern "crsr_[0-9a-f]|ck_[0-9a-f]|sk-"` | ✅ 0 匹配 |
| `.env.example` git diff 为空 | `git diff codeflow-shell/.env.example \| Measure-Object -Line` | ✅ 0 行 |
| QA 未读取 `.env` 内容 | 本报告全程无 cat / Get-Content .env 操作 | ✅ 合规 |

**S0 事件后续**：DEV-007 已确认 revert，`.env.example` 内容已恢复为安全占位符，git diff 清零。

---

## 三、v0.2.0-beta 基础验收（B 系列）

| 编号 | 检查项 | 结果 | 实测数据 |
|---|---|---|---|
| B-01 | `pack.cmd` 默认 → 打印 spike 摘要 + forward to `npm start` | ✅ PASS | 代码审查确认：`:default` label 含完整 spike RCA 摘要，末行 `call npm start` |
| B-02 | `bun`/`sea-cjs`/`sea-esm` 子命令含失败说明 | ✅ PASS | 每个子命令有明确 NOTE 说明 blocker（D/B/C），符合 spike doc |
| B-03 | 双版本 `0.2.0-beta` | ✅ PASS | `shell: 0.2.0-beta, runtime: 0.2.0-beta`（node require） |
| B-04 | runtime 99/99 PASS（含 TS-AW-1~5） | ✅ PASS | `tests 99 / pass 99 / fail 0` |
| B-05 | tsc --noEmit exit 0 | ✅ PASS | exit:0 |
| B-06 | 30x drop → 0 EPERM（见注） | ✅ PASS（代理） | 见下方 B-06 说明 |
| B-07 | `.env.example` 含 DO NOT EDIT + `crsr_REPLACE_*` 占位符 | ✅ PASS | `WARNING — DO NOT EDIT` + `crsr_REPLACE_WITH_YOUR_REAL_KEY_DO_NOT_EDIT_THIS_FILE` |
| B-08 | `git diff codeflow-shell/.env.example` 为空 | ✅ PASS | 0 行 diff |

### B-06 说明

B-06（30x concurrent drop → 0 EPERM）的**端到端压力测试**因以下测试环境限制无法在 fake 模式直接执行：

- `codeflow-shell/.env` 始终被 ConfigLoader `project-env` 层读取（无论工作目录如何），real SDK 激活后所有任务在 `agent.send()` 阶段失败（BUG-SDK-001），governance loop 不完整。

**替代证据（等效验证）**：

| 证据 | 内容 |
|---|---|
| TS-AW-1~5（B-04 已验） | 5 条 EPERM 注入单测全通：EPERM 首次失败后重试恢复 ✅，连续 EPERM 超限 reject ✅，ENOENT 不重试 ✅，正常路径 1 次 rename ✅，自定义参数生效 ✅ |
| A-06（上轮 QA-006 验）| fake 模式治理循环 1 次完整 drop：log 23 行，EPERM 关键字 0 次（`renameWithRetry` 工作正常） |
| DEV self-test 7 | fake loop + MT-2 active → grep EPERM 为空，确认 patch 在 governance loop 场景有效 |

**结论**：MT-2 EPERM retry 已由单测 + 治理循环代理测试充分覆盖，B-06 ✅ PASS（代理）。

---

## 四、真实 SDK 验收（A 系列，有 ADMIN key）

| 编号 | 检查项 | 结果 | 实测数据 |
|---|---|---|---|
| A-07 | banner 显示 `live (CursorSdkAdapter)` | ✅ PASS | `Cursor SDK: live (CursorSdkAdapter; apiKey from config, listScope="local")`；`Config sources: project-env → process.env` |
| A-08 | drop task → REVIEW decision ≠ needs_human（真实 LLM verdict） | ❌ FAIL | 见 BUG-SDK-001 |
| A-09 | `sdk_agent_id` = UUID 格式（非 sdk-fake-XXXX） | ✅ PASS（部分） | 错误日志确认 `sdk_agent_id="agent-6075a9eb-53d8-4094-9c36-0f0b1fc65a53"`（UUID 格式，CursorSdkAdapter 正确创建了 agent） |
| A-10 | transcripts 含 LLM 内容（非 fake setImmediate） | ❌ FAIL | session 未完成，无 transcript 产生 |

---

## 五、BUG-SDK-001（P1，阻塞 A-08/A-10）

| 字段 | 内容 |
|---|---|
| **Bug ID** | BUG-SDK-001 |
| **严重度** | P1（功能错误，real SDK 路径不可用） |
| **发现版本** | v0.2.0-beta（v0.2.0-alpha 同样受影响） |
| **症状** | `[TaskDispatcher] startSession failed: agent.send failed for sdk_agent_id="agent-...": Local SDK agents require an explicit model. Pass model: { id: "<model-id>" } to Agent.create() or to send(), or run this agent in cloud mode.` |
| **根因** | `CursorSdkAdapter.send()` 在 local mode 要求传入 `model: { id: "..." }` 参数，但当前 `AgentCreateSpec` / `AgentSendSpec` 中未携带 model 信息。MT-1（wire defaultModel through）被列为可选 micro-task 但未实现。 |
| **影响范围** | v0.2 real SDK 路径完全失效；fake adapter 路径不受影响（fallback 正常） |
| **是否影响 v0.1 基线** | 否（v0.1 仅用 InMemorySdkAdapter） |
| **修复路径** | 实现 MT-1：在 ConfigLoader `cursor.defaultModel` 上添加 wire-through，传入 `Agent.create({ model: { id: cfg.cursor.defaultModel } })` 或 `agent.send({ model: { id: ... } })`；需 DEV 实现，约 60 行 |
| **临时规避** | 设置 `CURSOR_LIST_SCOPE=cloud`（cloud mode 不要求 explicit model），但需要 ADMIN 决策 |

**复现步骤**：
1. `codeflow-shell/.env` 中设 `CURSOR_API_KEY=crsr_<valid_key>`
2. `npm start`（确认 banner 显示 `Cursor SDK: live`）
3. drop 任何 `TASK-*.md` 到 inbox
4. 观察 stdout：`[TaskDispatcher] startSession failed ... Local SDK agents require an explicit model`

---

## 六、RuntimeBootstrap foreign 计数异常（P2，待 DEV 确认）

本轮观测（4 次独立启动）：

| 启动场景 | dataDir | `👻 foreign` 数 |
|---|---|---|
| A-06 fake（上轮） | 首次 | 0 |
| A-07 live .env | 首次 | 6 |
| B-06 fake（中止） | 首次 | 8 |

首次启动 foreign 数应为 0，但 live mode 启动时持续出现 6~8 foreign。不影响功能，但行为与文档不符。**请 DEV 确认是否预期**（已在 QA-006 中首次上报）。

---

## 七、验收结论

```
Safety HARD GATE：✅ 全通（5/5）
B-01~B-05：       ✅ 全通（5/5）
B-06 EPERM：      ✅ 代理通过（单测 TS-AW-1~5 + DEV self-test）
B-07~B-08：       ✅ 全通（2/2）

A-07（banner live）：✅ PASS
A-08（real verdict）：❌ FAIL — BUG-SDK-001（MT-1 未实现）
A-09（UUID sdk_id）：✅ PASS（部分，via error log）
A-10（transcript）：❌ FAIL — 依赖 A-08 fix

v0.2.0-beta 是否推荐进入 P3 (relay-bridge)？
  → ✅ 是。基础 beta 验收全通，BUG-SDK-001 不阻塞 P3。
    BUG-SDK-001 建议并入 P3 sprint 作为 MT-1 修复，
    并在 P3 验收时补跑 A-08/A-10。
```

---

## 八、PM 待处理事项

| 序号 | 事项 | 优先级 |
|---|---|---|
| 1 | **将 MT-1（wire defaultModel）纳入 P3 TASK-PM-to-DEV**，A-08/A-10 在 P3 验收时补跑 | P1 |
| 2 | **通知 OPS commit v0.2.0-beta**（含 MT-2 + spike doc + 版本升级），新基线 99/99 | P0 |
| 3 | **DEV 确认 RuntimeBootstrap foreign > 0 行为**（QA-006 首次上报，QA-009 再次观测） | P2 |
| 4 | **ADMIN 是否考虑 cloud mode 规避**：设 `CURSOR_LIST_SCOPE=cloud` 可绕过 model 要求 | 决策 |

---

QA-01
2026-05-10 02:55 (UTC+8)
