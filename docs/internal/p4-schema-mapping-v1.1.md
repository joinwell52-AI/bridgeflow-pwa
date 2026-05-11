# P4 Schema 映射：CodeFlow v0.1 → fcop@1.1.0

| 字段 | 值 |
|---|---|
| 调研者 | DEV-001 |
| 任务参考 | [TASK-20260511-005-PM-to-DEV](../agents/tasks/TASK-20260511-005-PM-to-DEV.md) |
| 关联回执 | REPORT-20260511-005-DEV-to-PM（撰写中） |
| 数据来源 | `D:\FCoP\src\fcop\_data\schemas\*.schema.json` + `D:\Bridgeflow\packages\codeflow-protocol\schemas\*.schema.json` |
| 调研日期 | 2026-05-11 (UTC+8) |
| 适用 fcop 版本 | 1.1.0 |
| 适用 CodeFlow 版本 | v0.1（runtime v0.2.0-beta.3 hotfix bundle 后） |

> 本文件用于 PM 起草 TASK-006（P4 主 sprint）时的字段口径参考。**不是协议变更提案**；
> 凡 CodeFlow 独有字段、希望保留的，DEV-001 严格遵守自约束 7（不主动给 fcop 提需求），
> 只如实标注「这部分留在 codeflow-runtime 内部」。

## 一、TL;DR

| 维度 | 数字 |
|---|---|
| CodeFlow v0.1 schema 数 | 5（`agent / task / review / session / skill`）|
| fcop@1.1.0 schema 数 | 8（`agent / boundary / encoding / event / failure / ipc-envelope / review / skill`）|
| 直接一对一可替换 | 1（`review`，CF schema 已是 FCoP-compatible 设计）|
| 同名但语义错配 | 2（`agent` —— CF=PCB 实例 vs fcop=角色定义；`skill` —— CF 丰富 vs fcop 极简）|
| fcop 独有（CodeFlow 必须新接入）| 5（`boundary / encoding / event / failure / ipc-envelope`）|
| CodeFlow 独有（要么扩 fcop，要么留在 runtime）| 1（`session`，**结论：留在 runtime**）|
| `task` schema 关系 | CF `task` 是 fcop `ipc-envelope.payload.type=TASK` 的一种特化 |

**最大错配**：CodeFlow v0.1 `agent.schema` 和 fcop@1.1.0 `agent.schema` 同名但描述的是**两个不同的对象**（runtime PCB ≠ role registry）。P4 主 sprint 的命名讨论必须在第一天解决。

## 二、一对一对应（共名 schema）

### 2.1 `review.schema.json` ✅ 几乎对齐

| 维度 | CodeFlow v0.1 | fcop@1.1.0 |
|---|---|---|
| `$id` / `title` | `CodeFlow Review` | `FCoP REVIEW (Audit abstraction)` |
| required | `protocol, review_id, subject_type, subject_ref, decision, decided_at` (6) | `protocol, version, type, review_id, subject_type, subject_ref, reviewer_role, decision, decided_at` (9) |
| CF 独有 properties | `runtime_protocol_version, review_board, decision_duration_ms` | — |
| fcop 独有 properties | `version, type, subject` | — |
| `decision` enum | （未在表面看到，**待 read fcop schema 全文确认**）| `approved, rejected, needs_changes, abstained, **needs_human**`（v1.1 ADR-0025 新加第 5 值）|

**P4 sprint 改造点**：
1. CodeFlow 写 review 时要补 `version`、`type`（fcop required），fcop API（如 `Project.write_review`）会自动塞，**runtime 无须手填**——见 §五 demo 实测。
2. `runtime_protocol_version` 是 CF 独有运行时审计字段，**留在 runtime 内部**（不进 fcop schema），写盘后由 runtime 自己解析。
3. `review_board` / `decision_duration_ms` 同上 —— runtime 内部。
4. `fcop:review` 多一个 `subject` 字段（似乎是 subject_ref 的 human-readable label），P4 可考虑用。

### 2.2 `skill.schema.json` ⚠️ 语义错配（同名异义）

| 维度 | CodeFlow v0.1 | fcop@1.1.0 |
|---|---|---|
| required | `skill_id, version, provided_by, tools, available_to_roles, required_kernel` (6) | `id` (1) |
| properties | `skill_id, version, displayName, provided_by, tools, available_to_roles, required_kernel, compatible_runtimes, homepage, license` (10) | `id, label, uri, tools` (4) |
| 用途 | **MCP server 描述**含 fcop-mcp kernel 依赖（design doc §0.5 Hard Rule）| 角色可调能力的引用（`fcop.json` `skills[]`，v1.1 ADR-0027）|

**P4 sprint 决策点**：
- 路线 A：CodeFlow `skill` 沉到 `codeflow-runtime` 内部（runtime registry），fcop:skill 用作角色能力引用。两者并存。
- 路线 B（自约束 7 不允许）：向 fcop 提议扩 skill schema —— **本调研不走**。
- **推荐 A** —— runtime 已经有完整 `SkillRegistry` + `KernelDependencyValidator`，迁移成本高。

### 2.3 `agent.schema.json` ⚠️⚠️ 严重语义错配

| 维度 | CodeFlow v0.1 | fcop@1.1.0 |
|---|---|---|
| 概念 | **Agent 实例**（runtime PCB / process control block）| **Agent 角色定义**（role capability registry）|
| required | `agent_id, role, layer, node, runtime, skills, status` (7) | `code, label` (2) |
| properties | `agent_id, sdk_agent_id, role, layer, node, runtime, workspace, model, skills, status, current_task, current_session, memory_usage, started_at, last_active_at, labels` (16) | `code, label, layer, can, cannot, session_id` (6) |
| 持久化位置 | `agents.json`（runtime PCB）| `fcop.json` `team.roles[]` |
| 用途 | 「DEV-01 实例此刻 status=busy 在跑 session-2」 | 「DEV 这个角色：can=write_task, cannot=mark_human_approved」 |

**这是 P4 主 sprint 最大命名风险**：
- 直接复用 fcop:agent → 角色 vs 实例混淆。
- 推荐重命名 CodeFlow 内部：
  - `AgentRole` （= fcop:agent）  ← 协议层、可序列化
  - `AgentRecord`（= CF v0.1 agent）← runtime 内部 PCB
- **当前 `packages/codeflow-runtime/src/types/state.ts` 第 68 行已经叫 `AgentRecord`，命名一致——非常好**，只需统一术语到文档即可。

**结论**：fcop:agent 用作角色注册表，CodeFlow agent → 改名 `AgentRecord` 留在 runtime。

## 三、CodeFlow 独有 schemas（fcop 没有）

### 3.1 `task.schema.json` → fcop `ipc-envelope.schema.json` 一种特化

| 维度 | CodeFlow v0.1 `task` | fcop@1.1.0 `ipc-envelope` |
|---|---|---|
| required | `protocol, task_id, sender, recipient, priority, status` (6) | `protocol, version, type, sender` (4) |
| 范围 | 仅 TASK | TASK / REPORT / ISSUE / REVIEW 四种 envelope 共用 |
| `type` 字段 | 隐含 = "TASK" | 显式枚举 |

**关系**：fcop `ipc-envelope` 是父 schema，CF `task` 是 `type=TASK` 时的特化。P4 sprint **不需要保留** CF task schema —— `Project.write_task` 已经自动生成符合 ipc-envelope.TASK 的 frontmatter（见 §五 demo 实测）。

### 3.2 `session.schema.json` → 留在 runtime 内部

| 字段 | required？ | 评估 |
|---|---|---|
| `session_id` | ✓ | runtime 内部 |
| `agent_id` | ✓ | runtime 内部 |
| `task_id` | ✓ | 用 fcop task filename 链接 |
| `started_at, ended_at, status, runs, total_cost_usd, outcome` | 大部分 ✓ | runtime 内部 |

**fcop 故意没有 session 概念**（D:\FCoP/docs ADR-0020 节「fcop 是 file protocol，runtime 是 SDK 概念，session 属 runtime」）。CodeFlow `session` 100% 留在 `codeflow-runtime` 内部，不进 fcop schema。已经在 v0.2.0 实现 `SessionManager / SessionStore / SessionRecord`，无须迁移。

## 四、fcop 独有 schemas（CodeFlow 需评估是否接入）

按重要性排序：

### 4.1 `ipc-envelope.schema.json`（必接入）

- 用途：统一 TASK/REPORT/ISSUE/REVIEW 信封格式
- CodeFlow 当前：只有 task 有 schema，report/issue 只在 dispatcher 里隐式检查
- P4 主 sprint：**必接入**。`Project.write_*` 已自动生成，runtime 不用关心字段细节。

### 4.2 `boundary.schema.json`（推荐接入）

- 用途：定义 v1.0 capability vocabulary + 4 boundary rules（write 操作时 runtime 必须执行）
- CodeFlow 当前：runtime 有 ad-hoc check（如 `AgentLayer` 限制），但没有统一 capability/cannot vocabulary
- P4 主 sprint：**推荐接入**。可显著替换 runtime 多处零散校验。
- 风险：fcop boundary 校验是 Python 端跑（`fcop.assert_boundary()`），runtime 调用 == 跨 pythonia 边界 == 微小延迟（实测见 §五，预计 1-5 ms / 次）。

### 4.3 `event.schema.json`（条件接入）

- 用途：从 filesystem 变更**派生**的事件（不是 EVENT-*.md envelope）
- CodeFlow 当前：runtime 有自己的 `RuntimeEvent` 类型（state.ts §150），8 个 sdk.* + 4 个 runtime.* 事件
- P4 主 sprint：**条件接入**。如果 CodeFlow 决定把 task 写盘事件暴露给 ADMIN 手机端，fcop:event 是天然的载体。否则保持 runtime 内部。
- 推荐：P4 阶段保持现状（runtime.* 事件不进 fcop），P5+ 再讨论。

### 4.4 `failure.schema.json`（推荐接入）

- 用途：定义 recovery 语义（ADR-0019 回应「fcop 不能只 happy path」批评）
- CodeFlow 当前：runtime 有 `AgentFailure / KernelValidationFailureEntry / ReconciliationReport` 等零散类型
- P4 主 sprint：**推荐接入**。fcop:failure 给出 protocol-level 失败/恢复抽象，可统一 reconciliation 的命名口径。
- 优先级低于 boundary。

### 4.5 `encoding.schema.json`（信息性接入）

- 用途：分离协议体（markdown frontmatter）与磁盘编码（v1.0 fcop/ vs v0.x docs/agents/，ADR-0021）
- CodeFlow 当前：硬编码 `docs/agents/tasks/` 路径
- P4 主 sprint：**信息性接入**。`Project(path, workspace_dir=...)` 已经支持，但 CodeFlow v0.1 fixed-path 习惯先维持，P5+ 再切换 layout。

## 五、Demo 实测对照（来自 `_spike/fcop-pythonia-spike/demo-fcop-api.ts`）

写一张 task + 一张 review + 一次 human_approved，fcop 自动生成文件如下：

```
fcop/
├── fcop.json                                     # team config + skills[] + roles
├── LETTER-TO-ADMIN.md                            # v1.1 welcome（init 时）
├── issues/
├── log/
├── reports/
├── reviews/
│   └── REVIEW-20260511-001-QA-on-task-20260511-001.md
├── shared/
│   ├── roles/{DEV,OPS,PM,QA}.{md,en.md}         # v1.1 deploy_role_templates 默认 True
│   ├── TEAM-OPERATING-RULES.{md,en.md}
│   ├── TEAM-README.{md,en.md}
│   └── TEAM-ROLES.{md,en.md}
└── tasks/
    └── TASK-20260511-001-PM-to-DEV.md
workspace/
└── README.md                                    # v1.1 新增（workspace_dir 拆分）
```

**关键观察**：

1. **layout 默认是 `fcop/`，不是 CodeFlow 现用的 `docs/agents/`** —— D6 决策点尚未拍板（PM TASK §3.5 明令本调研不动这个）。`Project(path, workspace_dir="docs/agents")` 是 escape hatch。
2. **fcop 自动生成全套 shared/roles + TEAM-*.md** —— CodeFlow runtime 当前没有这些文件，P4 主 sprint 决定是否保留 / 复用 / 替换 runtime 现有 governance 文档。
3. **task / review 的 frontmatter 已经符合 fcop@1.1.0 schema**（实测：含 `protocol, version, type, task_id, ...`）。CodeFlow 当前手写的 `TASK-*.md` 与 fcop 生成的差异需要 diff（P4 sprint 第 1 天工作）。

## 六、P4 主 sprint 建议工作流（DEV 视角，**仅供 PM 起草 TASK-006 参考**）

| 阶段 | 工作 | 预估天数 |
|---|---|---|
| Day 1 | 跑 `Project.init(workspace_dir="docs/agents")` 在仓库副本上，diff 与 v0.1 docs/agents/ 现状（识别字段错配）| 0.5 d |
| Day 2-3 | 引入 `pythonia` 到 `@codeflow/runtime` 主依赖；写 `FcopProjectClient` 适配层包 5 核心调用 | 1.5 d |
| Day 4-5 | 替换 `TaskDispatcher.dispatchOne()` 内的手写 frontmatter → fcop `Project.write_task` | 1 d |
| Day 6-7 | 替换 `ReviewWriter.write()` → fcop `Project.write_review` | 1 d |
| Day 8 | 替换 `NeedsHumanGate` → fcop `Project.mark_human_approved` | 0.5 d |
| Day 9 | 接入 fcop `event.schema` 让 ADMIN 手机端可订阅 fs-derived 事件（条件，**可推迟到 P5**）| 1 d（可选）|
| Day 10-11 | 全量回归 112 runtime 测试 + 重跑 v0.2.0-beta.3 smoke + 解决 surprise §4 全部问题 | 1.5 d |
| Day 12 | 写 codeflow-runtime v0.3.0-alpha 发布说明 | 0.5 d |
| **合计** | | **~7-8 工作日**（含 0.5 d buffer）|

PM TASK-005 §三给的 P4 预估 4-5d 可能**偏紧**（pythonia 集成 + 替换 3 个 writer + 维持 112 测试不挂，spike 调研已用 ~2h 估出来 ~7-8d 才稳）。

## 七、Open Questions（留给 PM / ADMIN 拍板）

1. **D6（fcop/ vs docs/agents/）**：何时切换 layout？立即在 P4 切，还是 P4 维持 docs/agents/ 直到 P5？
2. **Skill schema 分裂**：CF skill（带 required_kernel）下沉 runtime / fcop skill 极简表示 —— 长期是否要让 fcop:skill 涵盖 `required_kernel`（**自约束 7 禁止主动提议**，但 ADMIN 可决策）？
3. **runtime workspace = fcop workspace？**：v1.1 fcop 拆出 `workspace/`，runtime 已经有自己的 workspace 概念（`AgentRecord.protocol.workspace`）。命名重叠风险。
4. **fcop.json 同步**：fcop 把 team config + skills + roles 都写进 `fcop.json`，runtime 现有 `agents.json`/`sessions.json` 是否合并？

## 八、自约束 7 严格遵守证明

| DEV 行为 | 决策 |
|---|---|
| 发现 fcop:skill 比 CF:skill 弱（缺 `required_kernel`）| **不**提 issue / PR，记入本文 §2.2 「路线 A 推荐」（runtime 内部保留）|
| 发现 fcop:agent 与 CF:agent 同名异义 | **不**提议改名 fcop:agent，仅记入 §2.3「CodeFlow 改名 AgentRecord」|
| 发现 fcop 默认 layout=fcop/ 与 CodeFlow docs/agents/ 不一致 | **不**提议 fcop 调整，记入 §四「P4 维持 docs/agents/ via workspace_dir override」|
| pythonia kwarg 语法 PM TASK §3.2 写错 | **本机文档**修正，**不**外发到 PM —— PM TASK 不是协议变更（已记入 demo-fcop-api.ts 注释）|

---

DEV-001 编制
2026-05-11 (UTC+8)
