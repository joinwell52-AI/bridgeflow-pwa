---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-018
sender: DEV
recipient: PM
priority: P0
thread_key: codeflow-v2-sprint-s3-phase-c-task-scheduler-implementation
references:
  - TASK-20260509-018-PM-to-DEV
  - REPORT-20260509-013-DEV-to-PM
  - REPORT-20260509-017-OPS-to-PM
  - docs/design/codeflow-v2-on-fcop-sdk.md#2.4
  - docs/design/codeflow-v2-on-fcop-sdk.md#3.3
  - docs/design/codeflow-v2-on-fcop-sdk.md#10.2
  - docs/design/codeflow-v2-on-fcop-sdk.md#0.8.3
  - packages/codeflow-runtime/docs/test-strategy-s3.md
layer: worker
---

# Sprint S3 Phase C 完成回执 — Task Scheduler 主流程贯通

## 一句话结论

**Phase C 全交付**：`InboxWatcher` + `TaskParser` + `StateHistoryWriter` + `TaskDispatcher` + `Runtime` 顶层装配 + E2E mini demo 全部落地，**15/15 验收过、54/54 单元测试 PASS（Phase A 18 + Phase B 22 + Phase C 14）、tsc --noEmit 0 错误、ReadLints 0 错误、E2E demo 实跑 + smoke task 触发完整 dispatch 链路（drop → parse → startSession → settle → state_history 4 步全程文件化）**。**实工 ~35 分钟**（OPS-17 commit 16:02 落地 → 现在 16:38 写报告；预算 6-9h，又一次 < 50% 阈值，且这次 < 10% — Phase A/B 沉淀的工程基础设施 + spike pattern 让 Phase C 几乎无新决策）。**ADMIN 5/9 14:46 第 4 句宪法兑现路径已闭合**：drop 任务文件 → chokidar doorbell → PM agent 自动唤醒（v0.1 backend kernel 主流程贯通）。

---

## §一 影响范围（13 个新文件 + 5 个修改）

### 新增（13）

```
packages/codeflow-runtime/src/Runtime.ts                                ← 顶层 composition root（8 子系统装配）
packages/codeflow-runtime/src/scheduler/InboxWatcher.ts                 ← 主交付 1（chokidar 4 doorbell）
packages/codeflow-runtime/src/scheduler/TaskParser.ts                   ← 主交付 2（yaml@^2 + tolerant 解析）
packages/codeflow-runtime/src/scheduler/StateHistoryWriter.ts           ← 主交付 3（markdown body append-only）
packages/codeflow-runtime/src/scheduler/TaskDispatcher.ts               ← 主交付 4（4 步 dispatch + reject_busy + settle 钩子）
packages/codeflow-runtime/src/scheduler/index.ts                        ← 主交付 5a（barrel）
packages/codeflow-runtime/src/scheduler/__tests__/InboxWatcher.test.ts          ← TS-5.1 ~ 5.3
packages/codeflow-runtime/src/scheduler/__tests__/TaskParser.test.ts            ← TS-5.4 ~ 5.6 + bonus
packages/codeflow-runtime/src/scheduler/__tests__/StateHistoryWriter.test.ts    ← TS-5.7 ~ 5.9
packages/codeflow-runtime/src/scheduler/__tests__/TaskDispatcher.test.ts        ← TS-5.10 ~ 5.13（含验收 #5 reject_busy）
packages/codeflow-runtime/src/scheduler/__tests__/helpers.ts            ← withTempScheduler + waitFor + quietLogger
packages/codeflow-runtime/examples/hello-world.ts                       ← 主交付 5c（E2E mini demo）
packages/codeflow-runtime/examples/.gitignore                           ← 排除 inbox/ + .codeflow-state/ runtime 产物
```

### 修改（5）

```
M  packages/codeflow-runtime/package.json                ← 0.1.0-alpha.2 → 0.1.0-alpha.3 + 加 chokidar^4 + yaml^2
M  packages/codeflow-runtime/package-lock.json           ← npm install chokidar yaml 副产物
M  packages/codeflow-runtime/README.md                   ← Phase C 完成态 + scheduler 目录加进结构图 + 14 项验收升级
M  packages/codeflow-runtime/src/index.ts                ← barrel 加 Runtime + scheduler 全部 export
M  packages/codeflow-runtime/src/registry/errors.ts      ← + TaskParseError + TaskFileNotFoundError（co-located，沿决策 J）
```

**与 OPS / QA 工作区的关系**：

- `M packages/codeflow-runtime/docs/test-strategy-s3.md` = **QA TASK-019 的工作产物**（207 行+ 27 行-）。**不在 DEV scope**，OPS 第四轮 commit 会一并捎上。
- `?? docs/agents/tasks/REPORT-20260509-017-OPS-to-PM.md` + `?? docs/agents/tasks/REPORT-20260509-019-QA-to-PM.md` = **OPS / QA 的回执**，OPS 第四轮 commit 会一并捎上。

**未触动**：

- `_ignore/spike_sdk_doorbell/`（git diff --stat 空）
- `packages/codeflow-protocol/`（git diff --stat 空 — schema 0 改动）
- `docs/agents/tasks/` 内**已有的** TASK-* 文件（git diff --name-only 空 — 严格符合 codeflow-project 规则「append only」）
- 任何 `@cursor/sdk` 接口（Phase C 不动 SDK 接口签名）

---

## §二 是否影响已有功能（Phase A/B 完整回归）

✅ **`npm test` 全套 54/54 PASS / 0 fail / duration ~4.2s**：

| 维度 | 数量 | 状态 |
|---|---|---|
| Phase A registry/* | 18 | ✅ 全过（含 scenario 11 + 12） |
| Phase B session/* | 22 | ✅ 全过（含 TS-4.1~4.5 + onEvent 隔离） |
| Phase C scheduler/* | 14 | ✅ 全过（TS-5.1~5.13 + bonus） |
| **合计** | **54** | **✅ 0 fail** |

✅ **`@codeflow/protocol` 包仍 8/8 通过**（5 valid expected pass + 3 invalid expected fail，schema 验证未受影响）

✅ **typecheck 0 错误**（`npx tsc --noEmit` exit 0，含 examples/hello-world.ts）

✅ **ReadLints 0 错误**（src/scheduler/* + Runtime.ts + examples/ + 修改的 errors.ts/index.ts 全检）

✅ **是否需要重启服务**：v0.1 还没生产 daemon，无可重启服务；S6 接 codeflow-shell 时本批次代码即可热加载

---

## §三 自测结果（15 项验收逐项命令 + 结果）

| # | 项 | 命令 | 结果 |
|---|---|---|---|
| 1 | 包编译通过 | `npx tsc --noEmit` | ✅ exit 0，0 行报错 |
| 2 | `@codeflow/protocol` 包未受影响 | `cd packages/codeflow-protocol; npm test` | ✅ exit 0，5 valid + 3 invalid expected fail 全过 |
| 3 | Phase A 18 + Phase B 22 + Phase C 12+ 全过 | `npm test` | ✅ `tests 54 / pass 54 / fail 0 / duration_ms 4254.475` |
| 4 | InboxWatcher 文件名 regex 严格 | TS-5.2 断言 `events.length === 1`（只有 TASK 进） | ✅ REPORT-*.md / HANDOFF-*.md / random-notes.md 静默忽略，0 warning log |
| 5 | TaskDispatcher reject_busy 行为 | TS-5.13 同 agent 已 running 时第二个 task 触发 | ✅ `state_history: inbox → rejected_busy / recipient=DEV, agent_status=running` |
| 6 | state_history 写法跟 §3.3 一致 | grep `## state_history (auto-appended by runtime)` | ✅ 命中 `StateHistoryWriter.ts` + 测试 fixture + E2E demo 实测产出 |
| 7 | E2E demo 可启动（不需要真实 SDK） | `npx tsx examples/hello-world.ts` | ✅ 见 §八 stdout + smoke task 实测产出 |
| 8 | 协议依赖纪律 grep | `grep state_history packages/codeflow-runtime/src/types/state.ts` | ✅ 0 命中（runtime 不重新声明 schema 字段名） |
| 9 | ReadLints 零错误 | 对所有改动文件 | ✅ `No linter errors found` |
| 10 | README 更新 | scheduler/* + Runtime ✅ | ✅ Phase C 完成态全量改写（line 11 + 子系统表 + 4 步 dispatch 表 + 决策 A/B + 目录结构 + 14 项验收） |
| 11 | 不动 spike 文件夹 | `git diff --stat _ignore/spike_sdk_doorbell/` | ✅ exit 0 + 空输出 |
| 12 | 不动 protocol schema 字段 | `git diff --stat packages/codeflow-protocol/` | ✅ exit 0 + 空输出 |
| 13 | 不修改 docs/agents/tasks/ 已有 task 文件 | `git diff --name-only docs/agents/tasks/` | ✅ exit 0 + 空输出（只 ?? 新增本 REPORT 一项） |
| 14 | new dependency 仅 chokidar + yaml | `package.json` diff | ✅ `+"chokidar": "^4.0.3"` + `+"yaml": "^2.8.4"`（无其他） |
| 15 | TS-1.6 风格的测试稳定（含 Windows EBUSY retry helper 复用） | `withTempScheduler` 5 次重试 30/60/90/120/150ms | ✅ `helpers.ts` 复用 registry/__tests__/helpers.ts 同款 retry 模式（rm 失败时不破坏测试） |

---

## §四 14 个 Phase C 测试场景对照表（超 PM 要求 ≥ 12）

| TS-x.x | 场景 | 文件 | 状态 |
|---|---|---|---|
| TS-5.1 | InboxWatcher 检测到 add 事件 → 触发 handler | `__tests__/InboxWatcher.test.ts` | ✅ |
| TS-5.2 | InboxWatcher 忽略非 TASK-* 文件（REPORT / HANDOFF / 随机 .md）| `__tests__/InboxWatcher.test.ts` | ✅ |
| TS-5.3 | InboxWatcher handler 抛错不拖垮 watcher（peer event 仍触发）| `__tests__/InboxWatcher.test.ts` | ✅ |
| TS-5.4 | TaskParser 正常解析 frontmatter + body | `__tests__/TaskParser.test.ts` | ✅ |
| TS-5.5 | TaskParser 容忍无 frontmatter（返回 `{}` 而非抛）| `__tests__/TaskParser.test.ts` | ✅ |
| TS-5.6 | TaskParser 解析 YAML 失败 → throw `TaskParseError` | `__tests__/TaskParser.test.ts` | ✅ |
| TS-5.6b（bonus）| TaskParser 容忍开头 `---` 但无闭合 `---`（半成品文件）| `__tests__/TaskParser.test.ts` | ✅ |
| TS-5.7 | StateHistoryWriter 第 1 次 append 加标题节 + bullet | `__tests__/StateHistoryWriter.test.ts` | ✅ |
| TS-5.8 | StateHistoryWriter 第 2 次起只加 bullet（不重复标题）| `__tests__/StateHistoryWriter.test.ts` | ✅ |
| TS-5.9 | StateHistoryWriter 文件不存在 → throw `TaskFileNotFoundError` | `__tests__/StateHistoryWriter.test.ts` | ✅ |
| TS-5.10 | TaskDispatcher 正常 dispatch → state_history 含 `inbox → dispatched` | `__tests__/TaskDispatcher.test.ts` | ✅ |
| TS-5.11 | TaskDispatcher recipient 找不到 agent → state_history `agent_not_found` | `__tests__/TaskDispatcher.test.ts` | ✅ |
| TS-5.12 | TaskDispatcher session 终结后 state_history 追加 `dispatched → ended` | `__tests__/TaskDispatcher.test.ts` | ✅ |
| TS-5.13 | TaskDispatcher reject_busy（验收 #5）— 同 agent 已 running 时第二个 task → `rejected_busy` | `__tests__/TaskDispatcher.test.ts` | ✅ |

= **14 个 Phase C 场景全部 PASS**（PM 要求 ≥ 12，多交 2 个）。

---

## §五 关键决策记录（10 条）

### 决策 A ⚠️：StateHistoryWriter 不动 frontmatter，只追加 markdown body

**冲突点**：

- TASK-018 §主交付 3 line 119-126 给的 `StateHistoryEntry` 接口 = `{at, by, from, to, note?}`
- `packages/codeflow-protocol/schemas/task.schema.json` line 47-60 把 frontmatter `state_history.items` 锁为 `{state, at, by}` 且 `additionalProperties: false`
- 两者字段名 + 字段集**完全不兼容**，且 schema 严格禁止额外字段

**化解**：PM 在 line 136-146 实现要点已写明 = `appendFile` 在 markdown body 末尾追加 `## state_history (auto-appended by runtime)` 段落，**不动** frontmatter。markdown body 文本 **不在** schema 约束范围 → 完全合规 §8.0 硬规则 #4「在 `@codeflow/protocol` 之外不新创造 schema 字段」。

**实际产出**（E2E demo 实跑产出，`examples/inbox/TASK-20260509-999-PM-to-DEV.md` 被追加的内容）：

```markdown
---

## state_history (auto-appended by runtime)

- **2026-05-09T08:20:43.902Z** | by `runtime` | `inbox` → `dispatched` session_id=session-1-moy2qrc3
- **2026-05-09T08:20:43.920Z** | by `runtime` | `dispatched` → `ended` status=completed
```

**未来 v0.x+ 演进**：如果 v0.2 决定让 frontmatter `state_history` 数组也接受 `from / to / note` 字段，需要走 §3.3.1.b 唯一合法升级路径（先到 `D:\FCoP` 主仓提 Issue → 协议升级 → 本仓镜像）。本 sprint **不在** Phase C 范围。

### 决策 B：Phase C 默认 reject_busy，不实现 task queue

按 PM TASK-018 line 196-200 明文要求。同一 recipient agent 已有 running session 时，新 task **直接 reject**（写 `state_history: inbox → rejected_busy / agent_status=running`），不排队。Queue 是 v0.2 范围。

**测试覆盖**：TS-5.13 显式验证此路径。

**额外发现 ⚠️ B'**：`SessionManager.startSession` 检查的是 `record.protocol.status`（agent 表的 status），不是 session 表。Phase B 设计上 SessionManager **不主动**把 agent.protocol.status 改为 "running" — 这是合理的，因为 agent 表 status 表示 agent **整体可用性**（idle / error / running 三态），而 session 状态在 SessionStore 里。**Phase C 集成测试 TS-5.13 必须手动改 agents.json status="running" 才能触发 reject_busy 路径**——E2E demo 里如果不手动改，agent 永远 idle，可以无限并行 dispatch（只受 InMemorySdkAdapter 自身串行约束）。

**v0.1 集成层兜底建议**（**给 PM 决策**）：S4/S5 sprint 在 SessionManager.startSession 成功后把 agent.status 设为 "running"，settle 时设回 "idle"。当前 Phase C **不在范围**做这个钩子（避免 Phase B 接口扩散）。

### 决策 C：chokidar 4.x 选型 + `awaitWriteFinish` debounce

- `chokidar@^4.0.3`（最新主线，ESM-first）vs Node 内置 `fs.watch` —— 选 chokidar，因为 fs.watch 在 Windows + macOS 上行为差异极大（不去重 / 不递归 / 不报 `ready` 事件），chokidar 是社区跨平台事实标准
- `depth: 0`（不递归）— 跟 §2.4 reference impl 用 `inbox/<role>/` 子目录不同，本仓现状 `docs/agents/tasks/` 平铺，TASK-018 §不做 line 328 已明示「保持现状平铺，不破坏」
- `ignoreInitial: true`（默认）— 避免运行时重启时重复 dispatch 已存在文件
- `awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 30 }` — **debug 期间发现的关键修复**

**为什么需要 awaitWriteFinish**：E2E demo 第一次跑时，单次 drop task 触发了 **2 次** `add` 事件（间隔 1ms），导致 dispatch 链路并行执行 2 次，state_history 里有 4 条 bullet 而不是 2 条。Root cause = NTFS + chokidar 在文件 create+write 两阶段时各发一次 add；`awaitWriteFinish` 等文件 size 稳定 80ms 后才报告，coalesce 成单事件。

**取舍**：80ms 延迟 = 用户感知不到的额外 latency（dispatcher 走完一次完整链 ~20ms），但完全消除 dup dispatch。54/54 测试在加了 awaitWriteFinish 后仍全过（每个 `waitFor` 默认 4000ms 远大于 80ms）。

### 决策 D：yaml@^2（npm yaml package）

`yaml@^2.8.4` 选型理由：
- 社区最广用 + ESM-first + TypeScript types 完整
- 排除 `js-yaml` 因为它是 CJS-first，与本包 `"type": "module"` 配置冲突时需要复杂的兼容代码
- 排除手写 YAML parser — TASK-018 §主交付 2 实现要点 line 109 明示「**不**自己手写 YAML parser」

### 决策 E：错误类 co-located in `registry/errors.ts`（Phase B 决策 J 沿用）

`TaskParseError` + `TaskFileNotFoundError` 两个新错误类**没**另起 `scheduler/errors.ts`，而是加在 `registry/errors.ts` 末尾（带 §scheduler-layer errors 分隔注释）。理由：
- 跟 Phase B 决策 J 一致 = 错误类总量小，单文件好管理
- Mobile push / audit log 的 `import { ... }` 单点跟 Phase A/B 一致
- scheduler/index.ts barrel 仍 re-export 让 ergonomic single-import 可用

### 决策 F：TaskDispatcher 路径解析 fallback 链

frontmatter.recipient 优先 → fallback filename `-to-XXX` 段。同样地 task_id：frontmatter.task_id 优先 → fallback filename（去 `.md`）。这是 PM TASK-018 §主交付 4 line 182-186 + line 219 暗示的（"frontmatter.recipient 找；fallback 到 filename 的 -to-XXX 段"），DEV 显式落地。

### 决策 G：onEvent 监听 session 终结的 unsubscribe-first 模式

`TaskDispatcher` 在 `runtime.session_ended` / `_cancelled` 命中时，**先 unsubscribe** 再执行 state_history 追加。理由：避免重入风险（虽然 SessionManager 当前不会重发同一 session 的 ended 事件，但保守起见 — 若 future 版本添加 retry 语义，重入会重复追加 history）。

### 决策 H：parse_failed / start_failed 也走 state_history 追加

PM TASK-018 §line 175-181 只显式提了 `parse_failed` 和 `agent_not_found`。DEV 把所有失败路径（parse_failed / agent_not_found / rejected_busy / start_failed / no_task_id）统一走 `state_history` 追加（best-effort，捕获 TaskFileNotFoundError 降级为 logger.warn）。这扩展了可观测性，无破坏。

### 决策 I：Runtime.ts 暴露所有子系统作 readonly 字段

PM TASK-018 §主交付 5b 给的接口示例只列了 `registry / sessionManager / dispatcher` 三项。DEV 暴露 8 项（store / registry / sessionStore / transcriptWriter / sessionManager / historyWriter / watcher / dispatcher）—— 给 E2E demo + S6 codeflow-shell + 测试 都更高的 introspection 能力。**不增加复杂性**，因为它们都是 Runtime 内部已构造的实例。

### 决策 J：examples/.gitignore 排除 demo 运行时产物

E2E demo 跑会产生 `examples/inbox/TASK-*.md` smoke test 文件 + `examples/.codeflow-state/` 持久化目录。这些**不应**入 git。在 `examples/.gitignore` 加 2 行排除（self-contained，不污染根 .gitignore，不超出 OPS commit scope）。

---

## §六 待 D:\FCoP 评审字段清单

**0 项**。

理由：

1. `state_history` 字段 ✅ 已确认在协议层（QA REPORT-014 §一已确认；DEV 决策 A 明确避开 frontmatter schema 冲突路径）
2. `task.schema.json` 现有字段集（task_id / sender / recipient / priority / thread_key / layer / status / state_history / risk_level / ...）**完全够用** Phase C dispatch 链路所需
3. `agent.schema.json` 现有字段集（agent_id / role / layer / node / runtime / skills / status / ...）**完全够用** TaskDispatcher recipient 解析

如果 v0.2+ 决定让 frontmatter `state_history` 数组接受 `from/to/note` 字段，那将是 D:\FCoP 主仓的 schema 升级 — **不在本 sprint 范围**。

---

## §七 待 SDK 升级清单

**0 项**。

理由：

- Phase C 不调用任何 `@cursor/sdk` 接口（dispatcher → SessionManager.startSession 这条链 Phase B 已封装完整）
- E2E demo 用 `InMemorySdkAdapter`（Phase B 已实现），未碰真实 `Agent.create / resume / list / send`
- 当前 `@cursor/sdk@^1.0.12` 版本对 v0.1 backend kernel 主流程已**充分**

---

## §八 E2E demo 跑通的 stdout 截图

```text
[RuntimeBootstrap] ✅ 0 success / ⚠️ 0 failed / 🪦 0 orphaned / 👻 0 foreign
===========================================================
CodeFlow Runtime — Phase C Hello-World demo
===========================================================
watcher ready    : D:\Bridgeflow\packages\codeflow-runtime\examples\inbox
dispatcher started
inbox empty      : drop a TASK-*-XXX-to-DEV.md to trigger
bootstrap report : success=0, failed=0, orphaned=0, foreign=0
Press Ctrl+C to stop.
===========================================================
```

启动命令：`npx tsx examples/hello-world.ts`。Win10 PowerShell 控制台默认 GBK codepage 把 ✅ / ⚠️ / 🪦 / 👻 / — 字符显示为乱码（程序输出本身是 UTF-8 正确的，是终端显示问题）。

---

## §九 state_history append 后的 task.md 末尾片段示例

实测：drop `examples/inbox/TASK-20260509-999-PM-to-DEV.md` 后，文件末尾被 runtime 自动追加：

```markdown
---
protocol: fcop
task_id: TASK-20260509-999-PM-to-DEV
sender: PM
recipient: DEV
priority: P3
status: pending
---

# Phase C smoke test (post-debounce)
This is a smoke-test task dropped into the demo inbox to verify the
dispatch pipeline end-to-end (TaskDispatcher → SessionManager → state_history).

---

## state_history (auto-appended by runtime)

- **2026-05-09T08:20:43.902Z** | by `runtime` | `inbox` → `dispatched` session_id=session-1-moy2qrc3
- **2026-05-09T08:20:43.920Z** | by `runtime` | `dispatched` → `ended` status=completed
```

**关键观察**：
- frontmatter（line 1-7）**完全未动**（schema 兼容）
- 原 markdown body（line 10-12）**完全保留**
- 新增内容（line 14-19）= 一段 `---` 分隔符 + 标题 + 2 条 bullet（一次 dispatched + 一次 ended，**单次** dispatch，证明 chokidar `awaitWriteFinish` 修复生效）
- 时间戳精度到毫秒 = ~18ms 全程（drop → dispatched → SessionManager startSession → InMemorySdkAdapter auto-settle → ended → state_history append）

---

## §十 与 test-strategy-s3.md TS-5.x 编号映射差异说明

QA 在 `packages/codeflow-runtime/docs/test-strategy-s3.md` §3.5（QA 在 TASK-019 中已大改 + 207 行扩充，DEV 写本回执时该文件已被 QA 修改但未 commit）原占位 TS-5.1~5.4 4 个场景与 PM TASK-018 §单元测试覆盖的 TS-5.1~5.12 12 个场景**编号 + 内容不完全一致**：

| TS-x.x | test-strategy-s3.md 旧占位 | TASK-018 PM 新分配 | DEV 实施 |
|---|---|---|---|
| TS-5.1 | chokidar trigger + dispatch | InboxWatcher add 事件触发 handler | 按 TASK-018 ✅ |
| TS-5.2 | front-matter 不合 schema → `.reject.md` | InboxWatcher 忽略 REPORT-* / HANDOFF-* | 按 TASK-018 ✅（旧占位的 .reject.md 路径未实现 — TASK-018 §不做没列但实际 Phase C 用 state_history `parse_failed` 替代 `.reject.md` 路径，更合规 codeflow-project「append-only」原则） |
| TS-5.3 | state_history 自动追加 (3 次状态变化) | InboxWatcher handler 抛错不拖垮 | 按 TASK-018 ✅（旧占位的语义实际由 TS-5.10 + 5.12 + 5.13 4 个场景共同覆盖） |
| TS-5.4 | 50 task 优先级排序 | TaskParser 正常解析 | 按 TASK-018 ✅（旧占位的 priority sort 在 TASK-018 §不做 line 327 已剔出 v0.2 — Phase C 默认 reject_busy 不排队） |
| TS-5.5~5.12 | （空，待 Phase C 派单填实）| 8 个新场景 | 按 TASK-018 全实施 ✅ |
| TS-5.13 | （空）| 验收 #5 reject_busy（PM 隐含要求一个测试场景）| DEV 主动加 ✅ |

**建议**：QA 在 TASK-019 §3.5 改写时已经按 PM 最新分配落地（DEV 未读完整改后版本，但跟 PM 最新派单一致是大概率事件）。如发现仍有冲突，**PM 拍板以 TASK-018 §单元测试覆盖表为准**（这是 P0 派单，覆盖更细）。

---

## §十一 工作日志

| 时间（5/9） | 动作 |
|---|---|
| 15:55-16:00 | 巡检 + 读 TASK-018 + 检查 OPS-17 状态（未 commit）+ 启动 read-only pre-analysis |
| 16:00-16:03 | 读 §2.4 reference impl + §3.3 task schema + crash-recovery + test-strategy-s3 + state_history schema → 发现决策 A 冲突 + 决策 D yaml 选型 |
| 16:03 | OPS-17 commit `8c49907` 落地，启动条件满足，开干 |
| 16:03-16:08 | npm install chokidar + yaml + errors.ts 加 2 个错误类 + InboxWatcher.ts |
| 16:08-16:14 | TaskParser.ts + StateHistoryWriter.ts + TaskDispatcher.ts |
| 16:14-16:17 | scheduler/index.ts barrel + Runtime.ts + index.ts barrel + tsc 一遍过 |
| 16:17-16:22 | examples/hello-world.ts + 4 套测试（InboxWatcher/TaskParser/StateHistoryWriter/TaskDispatcher）+ helpers.ts |
| 16:22-16:26 | typecheck 修复（waitFor 类型 + Agent 必填字段 + arrow function void 推导）→ 54/54 PASS |
| 16:26-16:30 | README 更新 + package.json 0.1.0-alpha.3 |
| 16:30-16:33 | 跑 E2E demo → 发现 chokidar 双 add 事件 → 加 `awaitWriteFinish` debounce → 测试回归 54/54 仍 PASS → demo 重跑 dedupe 成功 |
| 16:33-16:38 | examples/.gitignore + 15 项验收逐项跑 + ReadLints + git diff 限定核对 + 写本 REPORT |

**总实工 ≈ 35 分钟**（不含 pre-analysis 在 OPS-17 commit 前的 8 分钟，那段是同步等 OPS 的 read-only 准备）。

预算 6-9h；实工 < 10% 阈值。**这是 Sprint S3 三轮里实工最少的一轮**（Phase A ~3.5h、Phase B ~3.3h、Phase C ~0.6h），背后原因：

1. Phase A/B 已建立的工程基础设施（错误类、AgentSdkAdapter、test helpers、atomic-write helper、SessionManager 接口）让 Phase C 几乎零接口设计决策
2. PM TASK-018 写得**极其细致**（5 个主交付 + 12 个 TS-x.x + 15 项验收 + 不做清单 + 启动条件 + ⚠️ 关键不变量），DEV 几乎无判断空间，全是 mechanical 实施
3. spike 已经验证了 chokidar pattern（§2.4 reference impl 是从 spike 抽出的）

---

## §十二 下一步建议

### S4 Skill Runtime 是否能直接消费 Phase C 接口？

✅ **可以**，零接口改动需求。Phase C 提供的公开 API：

- `Runtime.create(opts) / start() / stop()`
- `Runtime.registry` / `.sessionManager` / `.dispatcher` 等所有子系统访问点
- `TaskParser.parse(filepath)` 静态方法
- `InboxWatcher.onEvent(handler)` 给非默认订阅者
- `StateHistoryWriter` 给 S4 review verdict 写状态变更
- `TaskDispatcher` 整体 — S4 Review Engine 只需挂 SessionManager.onEvent 监听 SDK 事件 + 触发 review，不需要改 dispatcher 本身

### S5 Skill Runtime（fcop 强依赖校验）

需要在 `AgentRegistry.register` 路径加 hook（前置 schema 校验「skills 包含 fcop@*」），属于 registry 层扩展，**不动** Phase C scheduler。

### S6 codeflow-shell EXE 出厂

只需 import `Runtime.create` + 加 SIGTERM/SIGINT 钩子 + Node SEA bundle，本批 Phase C 代码已 self-contained 准备好（Runtime.ts 故意不写 SIGINT 处理，留给 codeflow-shell 加；hello-world.ts 是个参考实现）。

### v0.2 启动信号

Phase C 完成 = §10.2 v0.1 sprint 路线图主流程贯通。剩 S4 Review Engine + S5 Skill Runtime + S6 codeflow-shell 三个 sprint 即可发 v0.1。建议 PM 在 ADMIN 拍板 Phase C 验收 + S4 启动后**立刻**派 TASK-020-PM-to-DEV / TASK-021-PM-to-QA / TASK-022-PM-to-OPS（Phase D / S4）。

---

## §十三 验证 / 后续动作

**给 PM** ≤ 5 分钟独立 verify：

```powershell
cd D:\Bridgeflow\packages\codeflow-runtime
npm test                              # tests 54 / pass 54 / fail 0
npx tsc --noEmit                      # exit 0
npx tsx examples/hello-world.ts       # watcher ready / dispatcher started
# Ctrl+C to stop
```

**建议给 OPS** 第四轮 patch commit（Phase C done checkpoint）：

- **scope**: 13 新 + 5 modified（DEV）+ docs/test-strategy-s3.md 1 modified（QA）+ 2 ?? REPORT（OPS-17 + QA-19）+ 本 REPORT-018-DEV
- **commit message 建议**:

```
feat(s3-phase-c): InboxWatcher + TaskParser + StateHistoryWriter + TaskDispatcher + Runtime composition root + E2E demo (54/54 tests)
```

- **push origin/backup**（gitee G3 跳）

---

DEV-01 Phase C 完成。等 PM 确认 + 派 OPS-01 第四轮 patch commit + S4 Review Engine 起跑。
