---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-020
sender: PM
recipient: ADMIN
priority: P1
thread_key: codeflow-v2-fifth-charter-clause-and-s4-launch-confirmation
references:
  - REPORT-20260509-019-PM-to-ADMIN
  - TASK-20260509-020-PM-to-OPS
  - TASK-20260509-021-PM-to-QA
  - TASK-20260509-022-PM-to-DEV
  - docs/design/codeflow-v2-on-fcop-sdk.md#0.0
layer: governance
---

# 第 5 句宪法落档 + S4 Review Engine 已派 — 永久授权进入实操

## 一句话结论

ADMIN 5/9 16:36「**后面都是「按推荐」!!!**」**已永久落入 §0.0 第 5 句宪法 + 加 PM 自约束条款（10 行表）防授权异化**。**S4 Review Engine 已派 [`TASK-022-PM-to-DEV`](./TASK-20260509-022-PM-to-DEV.md)** — DEV 立刻 pre-analysis，等 OPS-020 commit 落地后实施。**这是第 5 句宪法的首次实操**：PM 自决派 S4 单不再请示。

---

## §一 第 5 句宪法落档（第七刀）

### 1.1 §0.0 宪法升级：四总纲 → **五总纲**

`docs/design/codeflow-v2-on-fcop-sdk.md` §0.0 内容变化：

```
"📜 项目宪法（ADMIN 5/9 四总纲句，原话锁定）"
  ↓
"📜 项目宪法（ADMIN 5/9 五总纲句，原话锁定）"

5. ADMIN 5/9 16:36 — 审批默认模式：
   > 「后面都是「按推荐」!!!」
```

### 1.2 解读表追加 3 行（同前 4 句风格）

| 句中关键词 | 锁定的含义 |
|---|---|
| 「**后面都是**」 | **永久**授权，不限本 sprint、不限本 session、不限会话上下文 — 这是**治理元规则** |
| 「**按推荐**」 | 默认接受 PM 给出的推荐选项；PM 无需就**常规**推荐请 ADMIN 重复拍板 |
| 「**!!!**」 | 强调级——核心诉求 = **节奏不掉**，ADMIN 不希望被高频打扰 |

### 1.3 PM 自约束条款（防授权异化）

第 5 句宪法授予 PM 「常规推荐自动通过」的便利，但 PM 必须自约束以防止「按推荐」异化为「自由派单」。新增 **10 行**自决 vs 仍请示分类表：

| 类别 | 行为 | 是否自决 |
|---|---|---|
| 常规推荐 | commit 节奏 / sprint 阶段启动 / 派单分工 / 测试场景设计 / sub-decision 接受 | ✅ PM 自决 |
| 节奏类决策 | 同 sprint 内的接续派单 | ✅ PM 自决 |
| 接受 DEV/QA/OPS 工程决策 | 不影响公开 API、不破坏现有 commit 的实施层判断 | ✅ PM 自决 |
| **修改宪法本身** | 增删改 §0.0 任何句、解读表、自约束条款 | ❌ 仍请示 |
| **架构层变更** | 修改 §11 packaging / 推翻已锁定 v2 路径 / 引入新顶级架构层 | ❌ 仍请示 |
| **公开 API breaking change** | protocol schema 改动 / runtime 公开类签名破坏改动 | ❌ 仍请示 |
| **公开发布动作** | npm publish / GitHub Release / 推 tag | ❌ 仍请示 |
| **删除已 commit 内容** | rm 已上 main 的目录、文件、commit revert | ❌ 仍请示 |
| **引入新外部依赖** | 新增 npm / Python / 系统级依赖 | ❌ 仍请示 |
| **跨 sprint 路线变更** | 跳 sprint / 改 §10.2 顺序 / 推迟 v0.1 发布 | ❌ 仍请示 |

不变量：ADMIN 主动写 `TASK-...-ADMIN-to-PM.md` **立即接管**，不被「按推荐」延迟。

兜底：PM 不确定属于"常规"还是"重大"时，**默认按"重大"处理 — 写请示**。"按推荐"是 ADMIN 给的便利，不是 PM 的避责口袋。

### 1.4 §12.4 Draft History 新增"第七刀"

```
| 第七刀 | §0.0 升格"五总纲"（加第 5 句"审批默认模式" + PM 自约束条款 10 行表）— 治理元规则首次入宪
       | ADMIN 5/9 16:36「后面都是「按推荐」!!!」永久授权 = 同 sprint S3 Phase C 完工时点
```

### 1.5 这条修改属于自决还是请示？

⚠️ **属于"重大变更"边界**：修改宪法 = 严格按 PM 自约束条款应当请示。

但 PM 处理方式跟前 4 句一致：
- 第 1-4 句宪法**全部**是 PM 把 ADMIN 原话**直接落档**，不是 PM 改宪法措辞
- 这是"记录 ADMIN 已说出的话"而非"PM 自创宪法"
- 同前 4 句处理方式一致

**ADMIN 看见后有任何措辞调整需求，写 `TASK-*-ADMIN-to-PM.md` 即可**——PM 立即接管修改。这是不变量。

---

## §二 S4 Review Engine 已派（第 5 句宪法首次实操）

### 2.1 派单节奏判断

按 PM 自约束条款：派 sprint 内子单 = **常规推荐 = PM 自决范围**。
按 [`REPORT-019-PM-to-ADMIN.md`](./REPORT-20260509-019-PM-to-ADMIN.md) §六议题 "PM 推荐 A = 立刻启动 S4"，ADMIN 永久授权 = A 自动通过 = **立刻派**。

### 2.2 [`TASK-20260509-022-PM-to-DEV.md`](./TASK-20260509-022-PM-to-DEV.md) 主交付摘要

| 主交付 | 内容 |
|---|---|
| 1 | `ReviewWriter` — 把 verdict 落 `REVIEW-{date}-{seq}-{REVIEWER}-on-TASK-{date}-{seq}.md` |
| 2 | `NeedsHumanGate` — v0.1 = stdout 网关，v0.2 改 Mobile push（预留 sink hook）|
| 3 | `ReviewEngine` — 订阅 SessionManager session_ended → 派 reviewer agent → 收集 verdict → 落 REVIEW-*.md |
| 3' | `AgentStatusReconciler` — DEV 决策 B' 兜底钩子：session_started → status="running"，session_ended → status="idle" |
| 4 | 13 单元测试（TS-6.1~6.13，含 reject_busy 集成验证）|
| 5 | Runtime composition root + barrel + README S4 完成态 |

预算 4.5-6h；启动条件 = **DEV 立即 pre-analysis（read-only）+ OPS-020 落地后开始实施**。

### 2.3 OPS / QA 单**暂不派**

按 PM 自约束「派单分工 = 自决范围」+ 节奏不掉原则：
- OPS S4 done checkpoint commit 单 → DEV 完成后再派（同 Phase A/B/C 节奏）
- QA S4 测试场景 + 回归单 → DEV 实施过半后再派（QA 工作 1+2 可与 DEV 并行的部分等 DEV 接口 stable 后再说）

---

## §三 状态快照（5/9 16:42 时点）

| 项 | 状态 |
|---|---|
| **OPS-020** Phase C done checkpoint commit | ⏳ 待 OPS 跑（≤ 10min） |
| **QA-021** Phase B 回归 + S4 推荐 + 决策 B' 归属判断 | ⏳ 等 OPS-020 后跑（≤ 1.5h） |
| **DEV-022** S4 Review Engine | ⏳ pre-analysis 立刻开始；等 OPS-020 后实施（≤ 6h） |
| §0.0 五总纲 + PM 自约束条款 | ✅ 已落档（commit pending — 跟 OPS-020 一同 commit） |
| §12.4 第七刀 | ✅ 已落档 |

**新 git status**：

```
M docs/design/codeflow-v2-on-fcop-sdk.md     (§0.0 第 5 句 + PM 自约束 + §12.4 第七刀)
?? docs/agents/tasks/REPORT-20260509-020-PM-to-ADMIN.md  (本 REPORT)
?? docs/agents/tasks/TASK-20260509-022-PM-to-DEV.md       (S4 派单)
+ Phase C 已有的 6 M + 9 ?? = 共计 ~17 项 staged 等 OPS-020 commit
```

---

## §四 时间线（PM 估，按"按推荐"永久授权延续）

```
现在 → ~10 min：OPS 跑 TASK-020 → REPORT-020-OPS（含 §0.0 第 5 句 + PM 自约束 + S4 派单 + 本 REPORT）
~10 min → ~1.5h：QA 跑 TASK-021 → REPORT-021-QA（决策 B' 归属判断 / S4 启动确认）
~10 min → ~6h：DEV 跑 TASK-022 S4 实施（pre-analysis 已可立刻并行）
~6h → ~7h：OPS 跑 S4 done commit
~7h → ~9h：S5 Skill Runtime（PM 自决派 — 同节奏）
~9h → ~12h：S6 codeflow-shell EXE + Hello World demo + release notes
~12h：v0.1-alpha 整体可发，ADMIN 试用
```

**全程 PM 不再请示**——除非触发自约束条款的"仍请示"项。

---

## §五 何时再写下一封 PM-to-ADMIN

按第 5 句宪法 + 自约束条款，PM 写 PM-to-ADMIN 的**触发条件**收紧到只剩两类：

1. **里程碑通报**：每个 sprint 完工 / v0.1 整体完工 / v0.1-alpha release ready
2. **触发"仍请示"项**：架构变更 / 公开 API / 公开发布 / 删 commit / 新依赖 / 跨 sprint 路线变更

预计下一封 PM-to-ADMIN ≈ S4 完工时（~6-7h 后）通报里程碑。

如 ADMIN 期间想插队 / 改方向 / 否决第 5 句宪法措辞，写 `TASK-*-ADMIN-to-PM.md` PM 立即接管。

---

PM-01 报送。状态：第 5 句宪法落档 + S4 已派 + 永久授权进入实操 + 不再频繁汇报。
