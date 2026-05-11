---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-021
sender: QA
recipient: PM
priority: P1
thread_key: codeflow-v2-sprint-s3-phase-c-regression-test-and-final-verdict
references:
  - TASK-20260509-021-PM-to-QA
  - REPORT-20260509-018-DEV-to-PM
  - REPORT-20260509-019-QA-to-PM
  - packages/codeflow-runtime/docs/test-strategy-s3.md
layer: governance
---

# REPORT-021：Phase B 回归 + S4 推荐 + 决策 B' 归属 + TS 编号对齐（TASK-021 全交付）

## 一句话结论

**54/54 全过，0 fail，Phase B 22 项无回归，Phase C 14 项 acceptance 全过。✅ 推荐进入 Sprint S4（Review Engine）。决策 B'（AgentStatusReconciler）归属 S4（TASK-022 已含）。TS-4.6 确认 v0.2。TS-5.12/5.13 编号已修正对齐 DEV 实现。**

---

## §一 npm test 实测 stdout

**执行时间**：2026-05-09 16:55（UTC+8）
**执行目录**：`D:\Bridgeflow\packages\codeflow-runtime`
**命令**：`npm test`

```
> @codeflow/runtime@0.1.0-alpha.3 test
> node --import tsx --test "src/**/__tests__/*.test.ts"

✔ register: normal flow persists record + sets sdk_agent_id (67ms)
✔ register: schema validation rejects missing layer (3ms)
✔ register: layer=admin throws LayerViolationError before SDK is touched (2ms)
✔ register: SDK create throws → agents.json is not written (2ms)
✔ resume: SDK knows the id → record's reconciled_at is updated (59ms)
✔ resume: agent not in store → AgentNotFoundError (2ms)
✔ loadAll returns [] when agents.json doesn't exist (12ms)
✔ saveAll then loadAll round-trips records (34ms)
✔ upsert adds new record then replaces it on second call (498ms)
✔ removeById deletes existing, no-ops missing (228ms)
✔ loadAll throws RegistryWriteError on corrupt JSON (10ms)
✔ scenario 10: rename failure → original agents.json preserved, .tmp visible (169ms)
✔ scenario 11: concurrent upsert via Promise.allSettled does not corrupt agents.json (189ms)
✔ bootstrap: 2 known records → report.success.length === 2 (118ms)
✔ bootstrap: record's sdk_agent_id absent from SDK → orphan_local (39ms)
✔ bootstrap: SDK exposes a foreign id → report.foreign + agents.json unchanged (42ms)
✔ bootstrap: register during run() throws RuntimeNotReadyError (42ms)
✔ bootstrap: SDK.list() throws → RuntimeBootstrapError (TS-2.8 B) (25ms)
▶ InboxWatcher
  ✔ TS-5.1: fires handler on add of a TASK-*.md file (183ms)
  ✔ TS-5.2: ignores REPORT-*.md, HANDOFF-*.md, and arbitrary .md files (260ms)
  ✔ TS-5.3: a throwing handler does not take the watcher down (244ms)
✔ InboxWatcher (692ms)
▶ StateHistoryWriter
  ✔ TS-5.7: first append adds heading + bullet (37ms)
  ✔ TS-5.8: subsequent appends only add a bullet, never duplicate the heading (85ms)
  ✔ TS-5.9: missing target file → throws TaskFileNotFoundError (54ms)
✔ StateHistoryWriter (178ms)
▶ TaskDispatcher
  ✔ TS-5.10: drop TASK file → state_history `inbox → dispatched` (239ms)
  ✔ TS-5.11: recipient with no registered agent → state_history `agent_not_found` (160ms)
  ✔ TS-5.12: session_ended emits → state_history appends `dispatched → ended` (215ms)
  ✔ TS-5.13 (validation #5): second task while agent busy → `rejected_busy` (417ms)
✔ TaskDispatcher (1033ms)
▶ TaskParser
  ✔ TS-5.4: parses well-formed front-matter + body (146ms)
  ✔ TS-5.5: tolerates a file with no front-matter (31ms)
  ✔ TS-5.6: throws TaskParseError on malformed YAML front-matter (19ms)
  ✔ bonus: tolerates an opening --- without a closing --- (20ms)
✔ TaskParser (220ms)
✔ TS-4.1: startSession on unknown agent → AgentNotFoundError (9ms)
✔ TS-4.1b: startSession on agent in status=running → InvalidAgentStatusError (75ms)
✔ TS-4.2: startSession success → record persisted + session_started emitted (82ms)
✔ TS-4.3: high-volume planted events drain without loss (throughput sanity) (62ms)
✔ TS-4.4: cancelSession orders SDK-cancel before persist + emits runtime.session_cancelled (61ms)
✔ TS-4.4b: cancelSession on unknown id → SessionNotFoundError (7ms)
✔ TS-4.5: cancelAllForEmergencyStop uses Promise.allSettled (one failure does not block peers) (103ms)
✔ onEvent: throwing listener gets unsubscribed; peers keep receiving (94ms)
✔ SessionStore: save → load round-trips (66ms)
✔ SessionStore: load returns null on absent (does NOT throw) (3ms)
✔ SessionStore: listAll returns [] on missing directory (6ms)
✔ SessionStore: listAll returns multiple records (316ms)
✔ SessionStore: listAll skips .tmp + non-.json + corrupt files (tolerant) (123ms)
✔ SessionStore: remove is idempotent + load(null) afterwards (32ms)
✔ SessionStore: corrupt JSON read throws RegistryWriteError (not silent null) (35ms)
✔ SessionStore: save uses atomic-rename (no half-written file) (35ms)
✔ TranscriptWriter: attach + auto-emit + close writes session_started/ended markers (19ms)
✔ TranscriptWriter: append writes a single-line entry with ISO + kind prefix (7ms)
✔ TranscriptWriter: append normalizes multi-line text to single line (7ms)
✔ TranscriptWriter: re-attach on same runId returns same Unsubscribe (no double-open) (6ms)
✔ TranscriptWriter: __test.formatEventLine renders one line per event (0.2ms)
✔ TranscriptWriter: closeAll flushes every attached run (6ms)
ℹ tests 54
ℹ suites 4
ℹ pass 54
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4401.8018
```

---

## §二 回归汇总（Phase B 22 项逐项核）

| # | Phase B 测试场景 | 结果 |
|---|---|---|
| 1 | `TS-4.1: startSession on unknown agent → AgentNotFoundError` | ✅ pass |
| 2 | `TS-4.1b: startSession on agent in status=running → InvalidAgentStatusError` | ✅ pass |
| 3 | `TS-4.2: startSession success → record persisted + session_started emitted` | ✅ pass |
| 4 | `TS-4.3: high-volume planted events drain without loss` | ✅ pass |
| 5 | `TS-4.4: cancelSession orders SDK-cancel before persist + emits session_cancelled` | ✅ pass |
| 6 | `TS-4.4b: cancelSession on unknown id → SessionNotFoundError` | ✅ pass |
| 7 | `TS-4.5: cancelAllForEmergencyStop uses Promise.allSettled` | ✅ pass |
| 8 | `onEvent: throwing listener gets unsubscribed; peers keep receiving` | ✅ pass |
| 9 | `SessionStore: save → load round-trips` | ✅ pass |
| 10 | `SessionStore: load returns null on absent` | ✅ pass |
| 11 | `SessionStore: listAll returns [] on missing directory` | ✅ pass |
| 12 | `SessionStore: listAll returns multiple records` | ✅ pass |
| 13 | `SessionStore: listAll skips .tmp + non-.json + corrupt files` | ✅ pass |
| 14 | `SessionStore: remove is idempotent` | ✅ pass |
| 15 | `SessionStore: corrupt JSON read throws RegistryWriteError` | ✅ pass |
| 16 | `SessionStore: save uses atomic-rename` | ✅ pass |
| 17 | `TranscriptWriter: attach + auto-emit + close` | ✅ pass |
| 18 | `TranscriptWriter: append writes single-line entry` | ✅ pass |
| 19 | `TranscriptWriter: append normalizes multi-line text` | ✅ pass |
| 20 | `TranscriptWriter: re-attach on same runId returns same Unsubscribe` | ✅ pass |
| 21 | `TranscriptWriter: __test.formatEventLine renders one line per event` | ✅ pass |
| 22 | `TranscriptWriter: closeAll flushes every attached run` | ✅ pass |

**Phase B 22/22 无回归 ✅**

Phase C 14/14 acceptance 全过 ✅（TS-5.1~5.13 + bonus TS-5.6b，详见 §一 stdout）

Phase A 18/18 全过 ✅（基线稳定）

**合计：54/54 / 0 fail / duration 4401ms**

---

## §三 缺陷描述

**0 个缺陷**。Phase C 新增代码未破坏任何 Phase A/B 接口或行为。

---

## §四 S4 启动推荐

> ✅ **QA 正式推荐进入 Sprint S4（Review Engine）**

主要依据：

1. **54/54 全过**：v0.1 Backend Kernel 三层（AgentRegistry + SessionManager + TaskScheduler）测试稳定，Phase B 22 项无回归
2. **Phase C E2E 链路贯通**：DEV REPORT-018 §八实测（drop → dispatch → session → state_history，~18ms 端到端），符合 ADMIN 「不需要每个去通知」宪法第 4 句
3. **S4 接口零改动需求**：DEV REPORT-018 §十二确认 `Runtime.create / registry / sessionManager / dispatcher / StateHistoryWriter` 全部可直接消费，S4 Review Engine 只需订阅 `SessionManager.onEvent` 监听 session_ended
4. **TASK-022 已派**：PM 已自决派 S4 DEV 单（TASK-022-PM-to-DEV），DEV pre-analysis 已开始

**已无阻塞项**。

---

## §五 决策 B' 归属判断

**DEV REPORT-018 §决策 B'** 描述：SessionManager.startSession 成功后应将 `agent.protocol.status` 设为 `"running"`，session settle 时设回 `"idle"`——Phase B/C 未实现，建议 S4/S5 入手。

**QA 判断：归属 S4（已在 TASK-022 中）**

理由：

1. **TASK-022 主交付 3'** 已明确包含 `AgentStatusReconciler`（见 REPORT-020-PM-to-ADMIN §二 2.2）：`session_started → status="running"`，`session_ended → status="idle"`
2. S4 Review Engine 需要正确感知 agent 状态：ReviewEngine 在 `session_ended` 后派 reviewer agent 时，如果 reviewer 的 status 不准确（仍是 idle 即使已在运行），可能导致 reject_busy 逻辑失效
3. 不是 v0.2 范围——这是 v0.1 agent 状态一致性的基础约束，S4 不实现则 TS-5.13 reject_busy 只能在手动 patch `agents.json` 时触发，不适合 v0.1 生产验收
4. 不需要额外给 QA 或 DEV 派单——TASK-022 已涵盖

**结论**：决策 B' 在 S4 TASK-022 中实现，QA 在 S4 验收时写对应 TS-6.x 场景验证 status 钩子正确。

---

## §六 TS-4.6 + TS-5.x 编号差异最终确认

### 6.1 TS-4.6 是否需要在 S4/S5 补完

**结论：TS-4.6 确认为 v0.2 范围，不在 S4/S5 实施。**

TS-4.6 是"启动期扫描 status=running session → 恢复策略"（crash recovery：进程崩溃后重启，发现 SessionStore 中有 status=running 记录时如何处理）。

判断依据：
- 这是 **进程 crash** 后的状态恢复，属于 `crash-recovery.md §决策 4` 已标记的"Phase B 仅交付 SessionStore 读写 surface，不实现 reconciliation"
- 决策 B'（AgentStatusReconciler）是 **正常流程** 中 agent.status 同步，不同于 crash recovery
- S4 Review Engine（session_ended → review）和 S5 Skill Runtime 不依赖 running session 的 crash 恢复
- v0.2 sprint 才需要 session reconciliation（crash 场景）

**test-strategy-s3.md §3.4 末尾 TS-4.6 保持"Phase B / Phase C 决议中 → 确定 v0.2"状态**，不在当前 sprint 补完通过标准。

### 6.2 TS-5.x 编号差异最终确认

**差异**：QA 在 TASK-019 §3.5 补全时，TS-5.12 和 TS-5.13 顺序与 DEV 实际实现颠倒：

| TS 编号 | QA TASK-019 写法 | DEV 实际测试 | 状态 |
|---|---|---|---|
| TS-5.12 | reject_busy | session_ended → dispatched→ended | ❌ 顺序错 |
| TS-5.13 | session 终结追加 | reject_busy（validation #5）| ❌ 顺序错 |

**处置**：已在本轮 TASK-021 执行中修正 `test-strategy-s3.md §3.5` TS-5.12/5.13 顺序：
- TS-5.12 = session_ended emits → state_history `dispatched→ended`（与 DEV 实现一致）
- TS-5.13 = reject_busy 验收 #5（与 DEV `TS-5.13 (validation #5)` 一致）

**原因**：TASK-019 §3.5 是 QA 在 TASK-018 下发后独立规划，彼时 TASK-018 §单元测试覆盖表（TS-5.10~5.12）未明确 reject_busy 是 TS-5.12 还是 TS-5.13（验收 #5 只说"TaskDispatcher reject_busy 行为"需要一个测试场景）。DEV 把 session_ended 实现为 TS-5.12、reject_busy 实现为 TS-5.13，两者均合理，QA 以 DEV 实现为准对齐。

**内容无缺失**，仅顺序调换。§7 回归报告中测试名称已对应实际 stdout，无影响。

**TS-5.6b bonus**（bonus: tolerates an opening --- without a closing ---）：未在 QA §3.5 预规划，DEV 主动加。内容正确，属 TaskParser 容错场景增强，不需要补追 TS 编号（以 "bonus" 标记沿用 DEV 命名）。

---

## §七 是否建议立刻派 TASK-022（S4 DEV）

**已不需要——TASK-022 已由 PM 在 REPORT-020 时自决派出。**

QA 确认：DEV pre-analysis 已可立刻开始，OPS-020 commit 落地后 DEV 即可实施。QA 等 DEV 实施过半后接收 S4 测试策略规划任务。

---

## §八 §6 节命名说明（对应 TASK-021 §工作 3.2）

TASK-021 §工作 3.2 要求写 `§6 Phase B 回归测试结果`，但 `test-strategy-s3.md` 现有 §6 已命名为"字段归属判定与 FCoP 协调清单"。

**处置**：回归测试结果已写入 `§7 Phase B 回归测试结果 + Phase A/B/C 综合验收`（REPORT-019 工作 3 期间已落盘，本轮 TASK-021 执行后内容完整确认）。§6 FCoP 列表保留原名不变。

如 PM 需要强制按 §6 命名，QA 可以做 §6↔§7 互换，但当前 §7 内容完整且已满足 TASK-021 全部验收要求（54/54 stdout 体现、Phase B 22 项逐项、Phase C 14 项、S4 推荐、决策 B' 归属、TS 编号对齐）。

---

## §九 文件变更清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `packages/codeflow-runtime/docs/test-strategy-s3.md` | 修改 | §3.5 TS-5.12/5.13 顺序对齐 DEV 实现；§7 已有完整回归报告 |
| `docs/agents/tasks/REPORT-20260509-021-QA-to-PM.md` | 新建 | 本文件 |

---

QA-01 TASK-021 全部完成。等 OPS-020 commit 落地 + DEV-022 S4 实施中通知，届时 QA 接收 S4 测试策略任务。
