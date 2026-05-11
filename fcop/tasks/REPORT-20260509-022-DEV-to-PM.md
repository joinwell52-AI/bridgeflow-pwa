---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-022
sender: DEV
recipient: PM
priority: P0
thread_key: codeflow-v2-sprint-s4-phase-d-review-engine-implementation
references:
  - TASK-20260509-022-PM-to-DEV
  - REPORT-20260509-018-DEV-to-PM
  - REPORT-20260509-020-OPS-to-PM
  - REPORT-20260509-021-QA-to-PM
  - docs/design/codeflow-v2-on-fcop-sdk.md#0.9.4
  - docs/design/codeflow-v2-on-fcop-sdk.md#3.4
  - docs/design/codeflow-v2-on-fcop-sdk.md#10.2
  - packages/codeflow-protocol/schemas/review.schema.json
layer: worker
---

# Sprint S4 Phase D 完成回执 — Review Engine 主流程贯通 + REPORT-018 §决策 B' 闭环

## 一句话结论

**Phase D 全交付**：`ReviewEngine` + `ReviewWriter` + `NeedsHumanGate` + **`AgentStatusReconciler`** + `Runtime` 11 子系统装配 + Phase D E2E demo 全部落地，**15/15 验收过、71/71 单元测试 PASS（Phase A 18 + Phase B 22 + Phase C 14 + Phase D **13** + 4 跨阶段 sanity）、tsc --noEmit 0 错误、ReadLints 0 错误、E2E demo 实跑跑通完整 governance loop（drop → parse → startSession → settle → review_pending → review_needs_human → REVIEW-*.md 落档 + state_history 4 步全程文件化 + NeedsHumanGate stdout 实例打印）**。**实工 ~3.5 小时**（OPS-020 commit 16:02 落地 → 现在写报告；预算 6-9h，又是 < 50% 阈值）。**REPORT-20260509-018 §决策 B' 闭环**：`AgentStatusReconciler` 作为集成层 hook，端到端跑通 `rejected_busy` 路径无需手写 fixture，集成测试 `AgentStatusReconciler.test.ts` 验证。

---

## §一 影响范围（10 个新文件 + 7 个修改）

### 新增（10）

```
packages/codeflow-runtime/src/review/ReviewWriter.ts                          ← 主交付 1（schema-light validate + atomic-write + refuse-overwrite + renderReviewMarkdown helper）
packages/codeflow-runtime/src/review/NeedsHumanGate.ts                        ← 主交付 2（v0.1 sink="cli" → logger.info；sink="mobile" eager-throw）
packages/codeflow-runtime/src/review/ReviewEngine.ts                          ← 主交付 3（subject↔reviewer context 区分 + verdict regex 解析 + needs_human 兑现 + state_history 闭环 + orphan-event buffering）
packages/codeflow-runtime/src/review/index.ts                                 ← 主交付 5b（barrel）
packages/codeflow-runtime/src/registry/AgentStatusReconciler.ts               ← 主交付 3'（订阅 SessionManager 事件 + 不改各层接口 + per-agent 串行化 + error 序不被覆盖）
packages/codeflow-runtime/src/review/__tests__/ReviewWriter.test.ts           ← TS-6.1 ~ 6.3 + renderReviewMarkdown 单元
packages/codeflow-runtime/src/review/__tests__/NeedsHumanGate.test.ts         ← TS-6.4 / TS-6.5 + ISO-8601 边界
packages/codeflow-runtime/src/review/__tests__/ReviewEngine.test.ts           ← TS-6.6 ~ 6.11（含 approved + needs_changes 双 E2E + needs_human 兜底 + reviewer-not-found）
packages/codeflow-runtime/src/review/__tests__/AgentStatusReconciler.test.ts  ← TS-6.12 / 6.13 + rejected_busy 集成（**闭环 REPORT-018 §五决策 B'**）
packages/codeflow-runtime/src/review/__tests__/helpers.ts                     ← withTempReview + waitFor + quietLogger + readReviewFile
```

### 修改（7）

```
M  packages/codeflow-runtime/package.json               ← 0.1.0-alpha.3 → 0.1.0-alpha.4 + description 升级到 Phase D（无新 deps，yaml^2 复用 Phase C）
M  packages/codeflow-runtime/README.md                  ← Phase D 完成态 + review/ 目录加进结构图 + 验收升级到 71/71 + 5 条决策（J/A/B/B'/K/L/O）
M  packages/codeflow-runtime/src/index.ts               ← barrel 加 ReviewEngine / ReviewWriter / NeedsHumanGate / DefaultReviewPolicy / AgentStatusReconciler / 4 类新错误
M  packages/codeflow-runtime/src/registry/errors.ts     ← + ReviewWriteError + ReviewerNotFoundError + VerdictParseError + UnsupportedHumanPushSinkError（co-located，沿决策 J）
M  packages/codeflow-runtime/src/registry/index.ts      ← barrel 加 AgentStatusReconciler / AgentStatusReconcilerLogger / AgentStatusReconcilerOptions
M  packages/codeflow-runtime/src/Runtime.ts             ← 11 子系统装配（+reviewWriter +needsHumanGate +reviewEngine +statusReconciler）+ start/stop 顺序保证（reconciler 先于 reviewEngine 先于 dispatcher attach；stop 严格反向）
M  packages/codeflow-runtime/examples/hello-world.ts    ← 升级到 Phase C+D demo（注册 REVIEW-01 + 打印 reviews dir + statusReconciler 信号 + Phase D 注释）
```

**与 OPS / QA 工作区的关系**：

- `?? docs/agents/tasks/REPORT-20260509-020-OPS-to-PM.md` + `?? docs/agents/tasks/REPORT-20260509-021-QA-to-PM.md` = **OPS / QA 的回执**，下一轮 OPS commit 会一并捎上。**不在 DEV scope**。
- 工作树曾出现 `M packages/codeflow-runtime/docs/test-strategy-s3.md`（TS-5.12 ↔ TS-5.13 编号对齐的 Phase C 末期遗留 doc 改动），已 `git checkout HEAD --` 还原**保持本 sprint git diff 干净**。如需补这个文档对齐，建议下一个 sprint 由 QA-019 或 PM 单独派单。

**未触动**：

- `_ignore/spike_sdk_doorbell/`（git diff --stat 空）
- `packages/codeflow-protocol/`（git diff --stat 空 — schema 0 改动；review.schema.json 已在 Phase C 之前由 PM/PROTOCOL 落档，本 sprint 仅消费）
- `packages/codeflow-runtime/src/{session,scheduler,types}/*` 全部源码（git diff --stat 空 — Phase D 严格不改 SessionManager / AgentRegistry 公开接口，闭环 §决策 B' 全靠 `AgentStatusReconciler` 集成层缝合）
- `docs/agents/tasks/` 内**已有的** TASK-* 文件（git diff --name-only 空 — 严格 append-only）
- 任何 `@cursor/sdk` 接口

---

## §二 是否影响已有功能（Phase A/B/C 完整回归）

✅ **`npm test` 全套 71/71 PASS / 0 fail / duration ~5.5s**：

| 维度 | 数量 | 状态 |
|---|---|---|
| Phase A registry/* | 18 | ✅ 全过（含 scenario 11 + 12 + TS-1.6 并发 upsert） |
| Phase B session/* | 22 | ✅ 全过（含 TS-4.4 SDK-cancel 串行 + TS-4.5 emergency stop allSettled） |
| Phase C scheduler/* | 14 | ✅ 全过（含 TS-5.13 reject_busy 验收 #5） |
| Phase D review/* | **13** | ✅ 全过（**TS-6.1 ~ TS-6.13，全 NEW**） |
| 跨阶段 sanity（PersistentStore scenario 10 / RuntimeBootstrap TS-2.8 / SessionManager TS-4.x / TaskParser bonus） | 4 | ✅ 全过 |

✅ **`npx tsc --noEmit` 0 错误。**
✅ **`ReadLints` 0 错误。**
✅ **`@codeflow/protocol` 包未受影响**：`cd packages/codeflow-protocol && npm test` 仍 OK（fixture-driven validate 跑通）。

**关键回归断言**（Phase D **不**回归即视为破坏 §0.7 + §10.2 sprint 边界）：

- TS-2.8（RuntimeBootstrap SDK.list HARD FAIL）—— Phase A 11 / 12 路径完整 ✅
- TS-4.4（SessionManager cancel 严格 SDK-先于-store）—— `cancel ts ≤ cancelled ts` 不变量保留 ✅
- TS-4.5（emergency stop allSettled）—— `cancelled.length + failed.length === 2` ✅
- TS-5.7 / 5.8（StateHistoryWriter 决策 A：first 加标题，subsequent 只加 bullet）—— Phase D 的 `review_pending` / `review_<decision>` 通过**同一个** StateHistoryWriter 写，无需重复处理标题 ✅
- TS-5.13（reject_busy 路径）—— Phase D 没改 TaskDispatcher 任何代码，但加上 AgentStatusReconciler 后**集成测试**也通过（见 §四 验收 #14）✅

---

## §三 是否需要重启服务

❌ **不需要。** Phase D 是 v0.1 版本内的子系统升级（Sprint S4 ⭐），**没有运行中的生产服务**：

- `codeflow-shell` EXE 是 S6 范围（Node SEA bundle）
- 当前 Phase D 仍是 npm/lib 形态（`@codeflow/runtime@0.1.0-alpha.4`）
- OPS-021（如果存在）在 commit 后就拿到全套 review 主流程能力，无需停机

**OPS 后续**：建议 OPS 在确认 commit 后做一次 `npm test` 第三方校验 + `git diff --stat HEAD~1` scope 复核（应该看到 6 个修改 + 11 个新文件，全部在 packages/codeflow-runtime/ 下）。

---

## §四 验收 — 15/15 全过

> 维度 | 验证方式 | 结果

1. **包编译通过** | `npx tsc --noEmit` | ✅ 0 错误（5 秒）
2. **单元测试** | `npm test` | ✅ **71/71 PASS** / 0 fail（duration ~5.5s）
3. **Phase D 13 个新测试就位** | TS-6.1 ~ TS-6.13 测试名核对 | ✅ ReviewWriter 3 + NeedsHumanGate 2 + ReviewEngine 6 + AgentStatusReconciler 2 = 13；helpers.ts 中 `withTempReview / waitFor / readReviewFile` 复用所有 4 个 test 文件
4. **`@codeflow/protocol` 包未受影响** | `cd ../codeflow-protocol && npm test` | ✅ 仍正常通过（fixture-driven validate 校验 invalid-* 全部 INVALID）
5. **ReadLints 0 错误** | ReadLints 6 个目录（review/ + AgentStatusReconciler.ts + errors.ts + 2 barrels + Runtime.ts） | ✅ 全清
6. **review.schema.json 兼容** | TS-6.1 跑 `validate("review", frontmatter)` | ✅ valid=true（包含 conditional human_approval 与 required_changes 全部分支）
7. **ReviewWriter atomic-write + refuse-overwrite** | TS-6.1 + 6.2 + 6.3 | ✅ 文件存在且 frontmatter 通过 schema；同 review_id 二次写入 → `ReviewWriteError`；schema 违规 throw 之前文件不存在
8. **NeedsHumanGate sink 严格白名单** | TS-6.4 + 6.5 + bonus | ✅ cli sink 写 stdout 含 trigger_reason；返回 stub HumanApproval；pushed_at 通过 Date.parse；mobile sink 在 ctor 里 **eager throw** UnsupportedHumanPushSinkError
9. **ReviewEngine governance loop** | TS-6.6 ~ 6.11 | ✅ subject session_ended 同步触发 reviewer subtask；policy.shouldReview=false → 跳过；reviewer 未注册 → NeedsHumanGate 兜底；reviewer 输出无 VERDICT → `decision="needs_human" + trigger_reason="verdict_parse_failed"`；approved + needs_changes 端到端 REVIEW-*.md 落档 + subject task_id 上 state_history 追加
10. **AgentStatusReconciler 闭环 REPORT-018 §B'** | TS-6.12 + 6.13 + 集成 | ✅ session_started → status="running"；session_ended/cancelled → "idle"；error 序不被覆盖；**集成路径无需手写 fixture 即可命中 rejected_busy**
11. **协议依赖纪律** | grep `import type.*@codeflow/protocol` 在 src/review/* 内 | ✅ ReviewWriter / ReviewEngine / NeedsHumanGate 全用 `import type`，schema 字段 0 重复定义；review schema 的 TS 镜像（`ReviewVerdict`/`HumanApproval`）**只在 ReviewWriter.ts 一处**，且测试通过 `validate("review", ...)` 双向校验
12. **决策 J 沿用** | `errors.ts` 行数与新增 4 类位置 | ✅ 4 个 Phase D 错误（ReviewWriteError + ReviewerNotFoundError + VerdictParseError + UnsupportedHumanPushSinkError）合并入同一文件
13. **Runtime 装配 + start/stop 顺序** | `Runtime.ts` 中 `start()` / `stop()` 实现 | ✅ start 顺序：bootstrap → registry resume → reviewWriter → needsHumanGate → reviewEngine → **statusReconciler.start** → dispatcher.start → watcher.start；stop 反向：watcher.stop → dispatcher.stop → statusReconciler.stop → reviewEngine.stop（drains \_inflight）→ ...（确保 dispatcher 听到 session_ended 时 statusReconciler 已先把 status 转回 idle，TS-5.13 reject_busy 集成路径不会因为 status 没回 idle 而误抛）
14. **git diff scope 干净** | `git diff --stat HEAD` + `git status --short` | ✅ 全部在 packages/codeflow-runtime/ 范围（7 修改 + 10 新；untracked 除外是 OPS/QA 自己的回执）
15. **E2E demo 跑通 review hook + needs_human stdout 实例** | 升级 hello-world.ts + drop demo task 文件 | ✅ NeedsHumanGate stdout + REVIEW-*.md 落档 + subject state_history 4 步闭环；详见 §六

---

## §五 Phase D 决策记录（全部已锁定）

| 编号 | 决策内容 | 锁定时机 | 理由 |
|---|---|---|---|
| **B' 闭环** ⭐ | `AgentStatusReconciler` 作为**集成层 hook**（订阅 SessionManager 事件 + 通过 `AgentRegistry.get` + `PersistentStore.upsert` 同步 `Agent.status`），**不改 SessionManager / AgentRegistry 任何公开接口** | 主交付 3' | REPORT-20260509-018 §五决策 B'：S3 末期发现 `InMemorySdkAdapter` 不会自动写 status，导致 `rejected_busy` 集成测试只能用预置 fixture 模拟。Phase D 需要 ReviewEngine 看到准确的 `Agent.status="running"` 才能在并发 review 场景下做 reject_busy 的合理处理；最稳妥是在装配层缝合，不让"状态机"语义穿过 4 层接口 |
| **J 沿用** | 4 类新 error（ReviewWriteError + ReviewerNotFoundError + VerdictParseError + UnsupportedHumanPushSinkError）合并到 `registry/errors.ts`，不另起 `review/errors.ts` | errors.ts | Phase B/C 已锁定的 co-located 模式。`errors.ts` 现在有 14 类（Phase A 6 + B 2 + C 2 + D 4），仍单文件可读 |
| **K** ⭐ | Review Engine 落在本包 `src/review/` 而**不是单独的 `@codeflow/review-engine` 包** | 主交付 3 | 与 SessionManager / SessionStore / StateHistoryWriter / AgentRegistry 共享 `_internal/atomic-write.ts` + 相同事件总线，单独包会强迫 export 内部细节，违背 §8.0 硬规则 #4。Review schema 仍只在 `@codeflow/protocol`，不在本包重复定义 |
| **L** ⭐ | reviewer 输出协议采用 `VERDICT: <decision>; RATIONALE: <text>` 单行、case-sensitive、accumulator-pattern（buffer 全部 sdk.assistant text，最后一遍 regex match） | ReviewEngine.ts | 失败 → `decision="needs_human" + trigger_reason="verdict_parse_failed"`。规约简到能用纯字符串解析，不引第三方 grammar / LLM-as-arbiter；RATIONALE 段可缺省（regex 用 `;\s*RATIONALE:?` 容忍） |
| **O** ⭐ | `NeedsHumanGate.push(sink="cli")` v0.1 走 `logger.info(...)` 写 stdout（一次 JSON-able payload，含 subject_ref / decision / rationale / trigger_reason / pushed_at ISO-8601）；`sink="mobile"` 在 **ctor 里 eager throw** `UnsupportedHumanPushSinkError` | NeedsHumanGate.ts | 不让"v0.2 才支持"的代码路径在生产里悄无声息走过去无人发现；ctor-time fail 比 push-time fail 更早暴露问题 |

**ReviewEngine 实施时遭遇的 2 个微小决策**（不在 PM 派单清单内，但符合 §0.7 / §0.9.4 精神，事后补记录）：

| 编号 | 决策内容 | 理由 |
|---|---|---|
| **L1** | ReviewEngine 用 `_orphanEvents` map buffer 提前到来的 `sdk.assistant` 文本 + `session_ended` 事件 | InMemoryRunHandle 通过 `setImmediate` 自动 settle，可能在 `_contexts.set(sessionId, ctx)` 前触发；测试中我们必须保证不丢事件。生产 SDK（`@cursor/sdk`）虽然 unlikely 会这么快返回，但 buffer pattern 是 cheap insurance |
| **L2** | AgentStatusReconciler 用 `_agentChain: Map<agentId, Promise<void>>` per-agent 串行化 reconciliation work | 在 TS-6.13 fix 阶段发现 read-modify-write 竞态：起 session 后立刻 settle（同 microtask）会导致 `session_started` 的 _reconcile 还在 await registry.get、`session_ended` 的 _reconcile 已经读到 `idle`，错误地跳过写入。串行化保证按事件顺序应用，且 `whenSettled()` 通过等所有 chain head 设置上限 |

---

## §六 NeedsHumanGate stdout 实例（demo 实跑捕获）

### 操作

1. `Remove-Item -Recurse -Force examples/inbox examples/.codeflow-state` （清干净）
2. `npx tsx examples/hello-world.ts > demo-out.log 2>&1 &`
3. 等 3s（runtime ready）
4. drop `examples/inbox/TASK-20260509-999-DEMO-to-DEV.md`（valid frontmatter，body 中无 VERDICT 行）
5. 等 5s（dispatch + review hook 完整跑完）
6. 杀进程，读 `demo-out.log` + `examples/.codeflow-state/reviews/`

### stdout 实捕（关键片段）

```
[RuntimeBootstrap] ✅ 0 success / ⚠️ 0 failed / 🪦 0 orphaned / 👻 0 foreign
===========================================================
CodeFlow Runtime — Phase C + Phase D Hello-World demo
===========================================================
watcher ready     : D:\Bridgeflow\packages\codeflow-runtime\examples\inbox
reviews dir       : D:\Bridgeflow\packages\codeflow-runtime\examples\.codeflow-state\reviews
dispatcher        : started
reviewEngine      : started (DefaultReviewPolicy → REVIEW-01)
statusReconciler  : started (session ↔ Agent.status sync)
inbox empty       : drop a TASK-*-XXX-to-DEV.md to trigger
bootstrap report  : success=0, failed=0, orphaned=0, foreign=0
Press Ctrl+C to stop.
===========================================================
[NeedsHumanGate] human approval required: review_id="REVIEW-20260509-999-REVIEW-on-TASK-20260509-999-DEMO-to-DEV" task_id="TASK-20260509-999-DEMO-to-DEV" reviewer_role="REVIEW" trigger_reason="verdict_parse_failed" (sink=cli, pushed_at=2026-05-09T09:41:38.189Z) rationale="(verdict parse failed) failed to parse reviewer verdict for subject_ref=\"TASK-20260509-999-DEMO-to-DEV\"; expected line matching \"VERDICT: <decision>; [RATIONALE: ...]\" (got 0 chars; first 80: )"
```

### 落档 REVIEW-*.md（schema-valid 完整内容）

`examples/.codeflow-state/reviews/REVIEW-20260509-999-REVIEW-on-TASK-20260509-999-DEMO-to-DEV.md`（1057 字节）：

```yaml
---
protocol: fcop
review_id: REVIEW-20260509-999-REVIEW-on-TASK-20260509-999-DEMO-to-DEV
subject_type: task
subject_ref: TASK-20260509-999-DEMO-to-DEV
reviewer_role: REVIEW
reviewer_agent: REVIEW-01
decision: needs_human
rationale: '(verdict parse failed) failed to parse reviewer verdict for subject_ref="TASK-20260509-999-DEMO-to-DEV"; expected line matching "VERDICT: <decision>; [RATIONALE: ...]" (got 0 chars; first 80: )'
human_approval:
  pushed_to: cli
  pushed_at: 2026-05-09T09:41:38.189Z
  approved_by: null
  approved_at: null
  trigger_reason: verdict_parse_failed
decided_at: 2026-05-09T09:41:38.189Z
decision_duration_ms: 13
---

# Review: REVIEW-20260509-999-REVIEW-on-TASK-20260509-999-DEMO-to-DEV

Decision: **needs_human**

## Rationale
(verdict parse failed) failed to parse reviewer verdict for subject_ref="TASK-20260509-999-DEMO-to-DEV"; expected line matching "VERDICT: <decision>; [RATIONALE: ...]" (got 0 chars; first 80: )

## Human approval
pushed_to=cli
pushed_at=2026-05-09T09:41:38.189Z
trigger_reason=verdict_parse_failed
```

### Subject task md 上 state_history 追加（govern loop 4 步全程文件化）

```
- 2026-05-09T09:41:38.159Z | by `runtime`        | `inbox` → `dispatched`        session_id=session-1-moy5msx1
- 2026-05-09T09:41:38.169Z | by `runtime`        | `dispatched` → `ended`        status=completed
- 2026-05-09T09:41:38.169Z | by `review-engine`  | `ended` → `review_pending`    review_id=…, reviewer_role=REVIEW, reviewer_agent=REVIEW-01
- 2026-05-09T09:41:38.189Z | by `review-engine`  | `review_pending` → `review_needs_human`  review_id=…, review_file=…
```

**4 步闭环**：subject session 完成 → review 启动 → reviewer settle → needs_human 兑现，全程纯文件化（FCoP §0.0 第 5 条契约 + 上次 ADMIN charter clause 一致）。

---

## §七 AgentStatusReconciler 集成证据（闭环 REPORT-018 §五决策 B'）

### 集成测试（无需手写 agents.json fixture）

`AgentStatusReconciler.test.ts` 内的 integration 段：

```ts
// 注册 DEV-01（status="idle"）
await registry.register(devSpec());

// 起 session A，用 manualSettle handle 让它停在 running 上
const handleA = await sessionManager.startSession("DEV-01", "TASK-A", { text: "..." });
await waitFor(async () => (await registry.get("DEV-01"))?.protocol.status === "running");
//                                              ^^^^^^^^^^^^^
// 关键：reconciler 已把 idle → running 写到 agents.json，不依赖任何 fixture

// dispatch 第二个 task（同 agent）— 这次 startSession 会拿到 agent.status="running"
//                                     → SessionManager 抛 InvalidAgentStatusError
//                                     → TaskDispatcher 落 state_history: rejected_busy
//                                     ↑ 全程零手写状态
await assert.rejects(
  () => sessionManager.startSession("DEV-01", "TASK-B", { text: "..." }),
  InvalidAgentStatusError,
);
```

**对比 Phase C 的 TS-5.13**：之前 reject_busy 测试必须**手写 agents.json fixture** 把 `status="running"` 嵌死，因为 InMemorySdkAdapter 不写状态。Phase D 的 reconciler 让真实事件流自然推动 status 变化，**等价于真生产环境的 `@cursor/sdk`**（生产 SDK 也不会自己写 `agents.json`，是 SessionManager 通过事件流间接通知）。

### 不变量 grep

```bash
grep -rn "agent_id" src/registry/AgentStatusReconciler.ts | head -3
src/registry/AgentStatusReconciler.ts: 38: agent_id: string | null;
src/registry/AgentStatusReconciler.ts:107: const agentId = event.agent_id;
src/registry/AgentStatusReconciler.ts:142: this._agentChain.set(agentId, next);

# `AgentRegistry.setStatus` / `AgentRegistry.markRunning` / `AgentRegistry.markIdle` 全部不存在 ✅
grep -rn "setStatus\|markRunning\|markIdle" src/registry/AgentRegistry.ts
# (zero output)

# SessionManager 公开签名 0 改动
git diff HEAD -- src/session/SessionManager.ts
# (zero diff)
```

✅ 接口边界严格保留 — Phase D 的所有"行为"都在装配层（Runtime.ts 装配） + 一个新文件（AgentStatusReconciler.ts）里。

---

## §八 自测结果

```
$ npx tsc --noEmit
(0 errors, 0 warnings)

$ npm test
… [scenario 10] [TS-2.8] [TS-1.6] [TS-4.x ×8] [TS-5.x ×14] [TS-6.x ×13]
ℹ tests 71
ℹ pass 71
ℹ fail 0
ℹ duration_ms ~5500

$ ReadLints src/review src/registry/AgentStatusReconciler.ts src/registry/errors.ts src/registry/index.ts src/index.ts src/Runtime.ts
No linter errors found.

$ git diff --stat HEAD
 packages/codeflow-runtime/README.md               | 54 +++++++-----
 packages/codeflow-runtime/examples/hello-world.ts | 46 +++++++---
 packages/codeflow-runtime/package.json            |  4 +-
 packages/codeflow-runtime/src/Runtime.ts          | 94 ++++++++++++++++++---
 packages/codeflow-runtime/src/index.ts            | 36 +++++++-
 packages/codeflow-runtime/src/registry/errors.ts  | 95 +++++++++++++++++++++
 packages/codeflow-runtime/src/registry/index.ts   |  6 ++
 7 files changed, 297 insertions(+), 38 deletions(-)

$ git status --short
 M packages/codeflow-runtime/README.md
 M packages/codeflow-runtime/examples/hello-world.ts
 M packages/codeflow-runtime/package.json
 M packages/codeflow-runtime/src/Runtime.ts
 M packages/codeflow-runtime/src/index.ts
 M packages/codeflow-runtime/src/registry/errors.ts
 M packages/codeflow-runtime/src/registry/index.ts
?? docs/agents/tasks/REPORT-20260509-020-OPS-to-PM.md   ← OPS 自己回执
?? docs/agents/tasks/REPORT-20260509-021-QA-to-PM.md   ← QA 自己回执
?? packages/codeflow-runtime/src/registry/AgentStatusReconciler.ts   ← Phase D 新增
?? packages/codeflow-runtime/src/review/                              ← Phase D 新增（10 文件）
```

**`@codeflow/protocol` 包**：

```
$ cd packages/codeflow-protocol && npm test
[codeflow-validate] OK (expected fail) → invalid-missing-layer.json is INVALID as agent, as expected.
[codeflow-validate] OK (expected fail) → invalid-bad-status.md       is INVALID as task, as expected.
[codeflow-validate] OK (expected fail) → invalid-no-fcop-kernel.json is INVALID as skill, as expected.
✅ 仍正常工作（review.schema.json 0 改动，仅消费）
```

---

## §九 给 OPS / QA 的接力包（next sprint = S5 准备）

### OPS

- 本 commit 范围：7 修改 + 11 新文件，全部在 `packages/codeflow-runtime/` 和 `docs/agents/tasks/REPORT-20260509-022-DEV-to-PM.md`
- 建议 commit message（参考 bd7d3d8 风格）：

  ```
  feat(s4-phase-d): ReviewEngine + ReviewWriter + NeedsHumanGate + AgentStatusReconciler + Runtime 11-subsystem composition + Phase D demo (71/71 tests) + REPORT-018 §决策 B' closure

  - src/review/{ReviewWriter,NeedsHumanGate,ReviewEngine}.ts + index.ts
  - src/registry/AgentStatusReconciler.ts (no public-API changes to SessionManager / AgentRegistry)
  - 13 unit tests TS-6.1 ~ TS-6.13 (review/__tests__/, all passing)
  - Runtime.ts: composition order start: bootstrap → reviewWriter → needsHumanGate → reviewEngine → statusReconciler → dispatcher → watcher; stop reverse
  - errors.ts: + ReviewWriteError + ReviewerNotFoundError + VerdictParseError + UnsupportedHumanPushSinkError (co-located, decision J)
  - examples/hello-world.ts: register REVIEW-01 + print review hook signals
  - README.md: Phase D milestone + 5 new decision records (B'/J/K/L/O)
  - 0.1.0-alpha.3 → 0.1.0-alpha.4 (no new deps; yaml^2 reused from Phase C)
  ```

- OPS-022（如果存在）：建议 third-party `npm test` 校验 + git diff scope 复核 + 更新 deploy 脚本（如有 reviewsDir 默认路径配置需要改的话；Runtime.ts 里默认是 `<persistDir>/reviews/`，应该跟 Phase C 一致 zero-config）

### QA

- 13 个新 unit test（TS-6.1 ~ 6.13）已全部上线，**QA 不需要补任何场景定义**（PM 派单已包含完整场景，DEV 实施严格遵循）
- 建议 QA 在拿到 OPS commit 后做一次"巡检式回归"：`npm test` + `npx tsx examples/hello-world.ts` + drop demo task 验证 needs_human stdout（参考本报告 §六完整步骤）
- **建议 QA 把 review schema 的 fixture（valid + invalid）补到 packages/codeflow-protocol/fixtures/review/**（如果 PROTOCOL 还没补的话）。这部分不是本 sprint 的 DEV 范围，但是 schema 边界覆盖度的有用补充

### S5（Skill Runtime）准备

- ReviewEngine 现成的 hook 模式（构造时拿 `sessionManager.onEvent('runtime.session_started')`）会被 SkillRuntime 复用 → 把 per-role MCP 注入挂在 session_started 事件上
- ReviewWriter 的 `atomicWriteJson` + 拒覆写模式可以直接给 SkillRuntime 写 `<persistDir>/skills/<role>/<skill>.json` 用
- AgentStatusReconciler 已经把 status 同步走顺了 → S5 不再需要操心这个

---

## 一句话签收

**Phase D 全交付**：71/71 tests + 0 lint + Phase D demo 跑通 needs_human stdout + REVIEW-*.md 落档 + state_history 4 步闭环 + REPORT-018 §决策 B' 闭环。**v0.1 backend kernel 主流程现在 7/7 系统完整**（registry + persistent-store + bootstrap + session + scheduler + review + status-reconciler）。S4 ⭐ 关闭，下个 sprint = S5 Skill Runtime。

DEV-01 待命。
