---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-019
sender: PM
recipient: ADMIN
priority: P1
thread_key: codeflow-v2-sprint-s3-phase-c-done-and-s4-launch-decision
references:
  - REPORT-20260509-018-PM-to-ADMIN
  - REPORT-20260509-017-OPS-to-PM
  - REPORT-20260509-018-DEV-to-PM
  - REPORT-20260509-019-QA-to-PM
  - TASK-20260509-020-PM-to-OPS
  - TASK-20260509-021-PM-to-QA
layer: governance
---

# Sprint S3 Phase C 完工 — v0.1 Backend Kernel 主流程贯通 + S4 启动议题

## 一句话结论

**Phase C 35 分钟内全交付**（OPS-017 commit 16:02 → DEV 完工 16:38）。**v0.1 Backend Kernel 主流程贯通**——drop TASK 文件 → chokidar doorbell → 自动 dispatch → state_history 自动追加，**ADMIN 5/9 14:46 第 4 句宪法兑现路径已闭合**。**54/54 测试全过**，PM 已独立 verify。**已派 OPS-020（第四轮 commit）+ QA-021（工作 3 回归）按上一轮「按推荐」延续策略不再请示**。**只就 1 个新议题请 ADMIN 拍板：S4 Review Engine 是否立刻启动**？

---

## §一 巡检快照（5/9 16:38 时点）

| 角色 | 状态 | 输出 |
|---|---|---|
| **OPS-01** | ✅ 完成 TASK-017 | commit `8c49907` Phase B done checkpoint，origin + backup 已同步，gitee 按 G3 跳过 |
| **DEV-01** | ✅ 完成 TASK-018 + TASK-016 (TS-1.6 顺手) | Phase C 5 主交付 + 14 测试 + Runtime + E2E demo，**实工 ~35 分钟，预算 6-9h，< 10% 阈值** |
| **QA-01** | ✅ 完成 TASK-019 工作 1+2 | §3.5 13 场景 + §5c 验收清单 + test-strategy-s3.md 524→704 行 |
| **PM-01** | ✅ 独立复核 + 派 OPS-020 + QA-021 | tsc 0 错 + 54/54 tests + 派单 |

---

## §二 PM 独立复核结果（2 实证）

```
$ cd packages/codeflow-runtime
$ npx tsc --noEmit          # exit 0
$ npm test
✔ scenario 11: concurrent upsert via Promise.allSettled does not corrupt agents.json
✔ TS-2.8 / TS-4.1~4.5 / SessionStore × 8 / TranscriptWriter × 6 / scheduler × 14 / ...
ℹ tests 54
ℹ pass 54
ℹ fail 0
ℹ duration_ms 4798.7466
```

**100% 跟 REPORT-018-DEV 一致**——无 phantom test、无 skipped、无 todo。

---

## §三 v0.1 Backend Kernel 主流程贯通确认

| 流程节点 | 状态 |
|---|---|
| **AgentRegistry** + 持久化（agents.json）+ crash recovery | ✅ Phase A（commit 6595427）|
| **SessionManager** + SessionStore + TranscriptWriter | ✅ Phase B（commit 8c49907）|
| **InboxWatcher**（chokidar doorbell）+ **TaskParser** + **StateHistoryWriter** + **TaskDispatcher** + **Runtime** 顶层装配 + **E2E demo** | ✅ Phase C（commit pending OPS-020）|

**ADMIN 5/9 14:46 第 4 句宪法兑现路径**：

```
ADMIN 写 TASK-...-ADMIN-to-PM.md
  ↓
chokidar 自动检测 add 事件 (debounced 80ms)
  ↓
TaskDispatcher 解析 frontmatter → 找 PM agent → SessionManager.startSession()
  ↓
PM agent 自动唤醒，开始处理（无需「巡检 开工」）
  ↓
session 终结 → state_history 自动追加 dispatched→ended bullet
```

**E2E demo 实测**：drop smoke task → 18ms 完成全程，state_history 写入正确，drop → ended 单次（chokidar awaitWriteFinish 修复双 add 问题）。

---

## §四 PM 接受的 4 个 DEV 决策（从 REPORT-018 §五 10 条 + 1 个发现里挑出值得 ADMIN 知道的）

### 决策 A ⚠️：state_history 写在 markdown body 而非 frontmatter

**冲突**：`task.schema.json` 把 frontmatter `state_history.items` 锁为 `{state, at, by}` 且 `additionalProperties: false`，但 `StateHistoryEntry` 接口 = `{at, by, from, to, note?}`，字段集**完全不兼容**。

**化解**：DEV 用 `appendFile` 在 markdown body 末尾追加 `## state_history (auto-appended by runtime)` 段落，**不动** frontmatter。完全合规 §8.0 硬规则 #4「不在 protocol 之外造 schema」+ codeflow-project「append only」原则。

**后果**：v0.1 task 文件**有两套 state_history 体**——frontmatter 数组（按 schema）+ markdown body 节（runtime 自动追加）。这是过渡期方案。**v0.2 如果决定让 frontmatter 接受 from/to/note 字段，需要走 D:\FCoP 主仓 schema 升级路径**——本 sprint 不做。

### 决策 B'：agent.status 自动转 running 钩子留 S4 加

**发现**：DEV 实施 TS-5.13 reject_busy 测试时发现，`SessionManager.startSession` 成功**不**主动把 agent.protocol.status 改为 "running"——这是合理的（agent.status 表 agent 整体可用性，session 状态在 SessionStore），但意味着**当前 doorbell 路径 reject_busy 永远不会自然触发**（除非外层手动改 agents.json）。

**DEV 建议**：S4/S5 sprint 在 SessionManager.startSession 成功后把 agent.status 设为 "running"，settle 时设回 "idle"。**Phase C 不在范围**做这个钩子。

**PM 接受**：是合理的渐进设计。**已转给 QA-021 评估归属（S4 / v0.2）**——QA 工作 3 完成时给推荐。

### 决策 C：chokidar `awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 30 }`

**根因**：NTFS + chokidar 在文件 create+write 两阶段时各发一次 add 事件，导致单次 drop 触发 2 次 dispatch。
**修复**：等文件 size 稳定 80ms 后才报告，coalesce 成单事件。E2E demo + 54 测试都验证生效。

### 决策 D：yaml@^2 选型

ESM-first + TypeScript types 完整，排除 js-yaml（CJS-first 跟本包 `"type": "module"` 冲突）。

---

## §五 已派 2 单（按上一轮「按推荐」延续策略，**不再请示**）

| 派单 | 目的 | 启动条件 |
|---|---|---|
| [`TASK-20260509-020-PM-to-OPS.md`](./TASK-20260509-020-PM-to-OPS.md) | Phase C done checkpoint commit + push origin/backup（gitee G3 跳）| 立即可开干 |
| [`TASK-20260509-021-PM-to-QA.md`](./TASK-20260509-021-PM-to-QA.md) | 工作 3：Phase B 回归 + §6 写入 + S4 启动推荐 + 决策 B' 归属判断 | 等 OPS-020 commit 后 |

理由：
- **OPS commit 是流程内规定动作**（同 TASK-012 / TASK-015 / TASK-017 三轮节奏）
- **QA 工作 3 是 TASK-019 派单时已说明的"分两批交付"中的第二批**（[`REPORT-019-QA-to-PM.md`](./REPORT-019-QA-to-PM.md) §四已声明）
- **议题 4.4 v0.2 暂不**已在上一轮拍板，PM 不动 v0.2

---

## §六 议题：S4 Review Engine 是否立刻启动？（**新议题 — 请 ADMIN 拍板**）

按 [`docs/design/codeflow-v2-on-fcop-sdk.md` §10.2`](../../docs/design/codeflow-v2-on-fcop-sdk.md) v0.1 sprint 路线图：

| Sprint | 主题 | 关键交付 | 状态 |
|---|---|---|---|
| **S1** | Skeleton + Protocol Freeze | 5 个 schema | ✅ commit 6595427 |
| **S2** | AgentRegistry + Session Manager Design | 接口 + JSDoc | ✅ commit 6595427 |
| **S3** | Task Scheduler + AgentRegistry/SessionManager 实现 | 4 子系统 + Runtime | ✅ Phase A/B/C 全完，待 OPS-020 commit |
| **S4** | Review Engine | review.md 生成 + reviewer_role 派单 + verdict 写状态 | **待启动**（本议题）|
| **S5** | Skill Runtime | fcop 强依赖校验 + Skill 调用 | 待 |
| **S6** | E2E + 文档 + codeflow-shell | EXE 出厂 + Hello World demo + release notes | 待 |

**3 个候选**：

| 选项 | 内容 | 利 | 弊 |
|---|---|---|---|
| **A** ✅（PM 推荐）| 立刻启动 S4 — 派 TASK-022/023/024 给 DEV/QA/OPS（等 OPS-020 + QA-021 落地后立即派）| 节奏不掉 + Phase C 已贯通主流程，S4 直接消费现有接口 + DEV 实工速度极快（3 sprint 平均 ~2.5h）| S4 完成后还有 S5 + S6，可能进度比预期更快 |
| **B** | 等 OPS-020 + QA-021 完成后**先停一晚**，明天再启动 S4 | 给 ADMIN 喘息空间 + QA 工作 3 完整看 v0.1 现状 | 中断节奏 |
| **C** | 跳过 S4 直接启动 S6（先包 codeflow-shell EXE，让 ADMIN 早一天看到 v2 雏形）| ADMIN 视觉冲击大 — 「真的有 EXE 了」 | 跳 S4 → v0.1 没 review 能力 → 治理闭环不完整 → 不符合「四总纲」第 3 句「治理规则」|

---

## §七 等 ADMIN 的拍板项

**只 1 项需要拍板**（其他都已按上一轮延续）：

```
☐ S4 Review Engine 启动节奏：A / B / C
```

**PM 推荐 A**——节奏不掉，3 个 sprint 平均 ~2.5h 实工，团队火力全开能在今天/明天内完成 v0.1 Backend Kernel 全套（S4+S5+S6）。

如 ADMIN 选 B 或 C，PM 立即调整。

---

## §八 时间线（PM 估）

```
现在 → ~10 min：OPS 跑 TASK-020 → REPORT-020-OPS（Phase C done checkpoint commit）
~10 min → ~1.5h：QA 跑 TASK-021 → REPORT-021-QA（工作 3 回归 + S4 推荐）
~1.5h：PM 写 REPORT-020-PM-to-ADMIN（S4 启动确认 + 派 TASK-022/023/024）

如 ADMIN 选 A：
~1.5h → ~5h：S4 Review Engine 实施 + 测试
~5h → ~7h：S5 Skill Runtime
~7h → ~10h：S6 codeflow-shell EXE 包装 + Hello World demo + release notes
~10h：v0.1 Backend Kernel 主流程整体可发 v0.1-alpha 给 ADMIN 试用
```

---

## §九 等 ADMIN 反馈

- ☐ 本 REPORT 等 ADMIN 拍 §六 1 个议题 — 推荐 A
- ☐ 拍板后 PM 立即派 S4 单
- ☐ 不拍板 / 沉默 = OPS-020 + QA-021 自然完成，PM 在 ~1.5h 后再写 REPORT-020 等 ADMIN 拍

---

PM-01 报送。状态：Phase C 完工 + v0.1 Backend Kernel 主流程贯通 + 第 4 句宪法兑现 + 等 ADMIN 拍 S4 启动节奏。
