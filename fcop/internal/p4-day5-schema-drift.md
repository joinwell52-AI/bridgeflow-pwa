# P4 Day 5 — Schema drift 核验报告（Charter 5.4 视角）

| 字段 | 值 |
|---|---|
| 任务 | [`TASK-20260511-017-PM-to-DEV`](../tasks/TASK-20260511-017-PM-to-DEV.md) §3.1 |
| 撰写者 | DEV-001（Day 5） |
| 撰写日期 | 2026-05-11（UTC+8） |
| 数据来源 | `D:\FCoP\src\fcop\_data\schemas\*.schema.json`（fcop@1.1.0 / draft 2020-12）+ `D:\Bridgeflow\packages\codeflow-protocol\schemas\*.schema.json`（CodeFlow v0.1 / draft-07） |
| 前置文档 | [`p4-schema-mapping-v1.1.md`](./p4-schema-mapping-v1.1.md)（spike 阶段 / TASK-005 起草） |
| 验收任务 | Day 5 / TASK-017 §3.1：3 个共同 schemas 字段差异分类 + breaking/additive 判定 |
| 不属于本核验范围 | task / session（CodeFlow 独有 — Charter 5.4 涌现物）、boundary / encoding / event / failure / ipc-envelope（fcop 独有 — 治理/传输层） |

---

## §一 TL;DR

**3 个共同 schemas（`agent` / `review` / `skill`）经 Charter 5.4 重新框架后，无一是「mirror — drift = bug」关系**。spike 阶段 `p4-schema-mapping-v1.1.md` §2 早已发现「同名异义」，但 P4 主 sprint 启动时的 TASK-007 §四（PM 起草，5/11 上午）和 TASK-017 §2.1（PM 修订，5/11 下午）仍按「mirror drift」叙事编排 Day 5 工作。

**Day 5 重新框架后的正确判定**：

| Schema | spike 判定 | Charter 5.4 判定（本报告） | Breaking? |
|---|---|---|---|
| `agent` | 同名异义（PCB ≠ role registry） | **CodeFlow PCB schema — application-layer emergence per Charter 5.4** | No（两 schema 不撞 — 分别住 `agents.json` 与 `fcop.json/team.roles[]`） |
| `review` | 几乎对齐（v1.0 时代） | **Dual contract**：v0.3 fcop bridge 路径 → fcop@1.1.0 SSOT；yaml fallback 路径 → CodeFlow v0.1 schema（仍合法）| No（fcop-first / yaml-fallback 两路径各自验证） |
| `skill` | 同名异义（MCP server vs role capability） | **CodeFlow MCP registry — application-layer emergence per Charter 5.4** | No（两 schema 功能不同 — CodeFlow 管 `provided_by.transport/command`，fcop 管 `id+uri+tools` 引用） |

**结论**：v0.3.0-alpha 出厂**不需要任何 schema 修改**。需要的是：

1. ✅ 在 `types.ts` 顶部加 **schema ownership matrix**（Charter 5.4 视角）—— Day 5.2
2. ✅ 在 `docs/releases/v0.3.0-alpha.md` 加 **Schema ownership** 段 —— Day 5.3
3. ✅ 本报告作为 Day 6 / v0.3.0-beta+ 的 reference（任何 schema 改动决策都先回看这张表）

**Surprise（DEV 主动报警）**：PM TASK-017 §2.1 表格行 1-3 把 agent/review/skill 全部判为「共同 — 需 drift 核验」，框架错了 —— 这是 **PM 第 19 次错位**，path 三件套**已在派单前查 path 存在 + permissions**，但**没查"schema concept 是否真是 mirror 关系"**（这是「内容三件套」第 3 件应有项 — 见本报告 §五）。

---

## §二 详细差异（按 schema）

### 2.1 `agent.schema.json` — Charter 5.4 PCB emergence

#### 2.1.1 概念错位

| 维度 | CodeFlow v0.1 (`packages/codeflow-protocol/schemas/agent.schema.json`) | fcop@1.1.0 (`D:\FCoP\src\fcop\_data\schemas\agent.schema.json`) |
|---|---|---|
| 概念 | **Agent runtime PCB**（process control block — 当前状态、当前任务、SDK session、Cursor SDK agentId）| **Agent role identity**（lifecycle / capability — `can` / `cannot` / boundary token） |
| 持久化位置 | `<state-dir>/agents.json`（runtime registry，每次 spawn / status change 都写）| `<workspace>/fcop.json` 内 `team.roles[]`（init 时写一次）|
| 主键 | `agent_id` (`^[A-Z][A-Z0-9_-]+(-\d+)?$`) | `code` (`^[A-Z][A-Z0-9]{0,15}$`) |
| `$schema` draft | draft-07 | draft 2020-12 |
| required | 7 字段 (`agent_id, role, layer, node, runtime, skills, status`) | 2 字段 (`code, label`) |
| `additionalProperties` | `false`（严格）| `true`（开放扩展）|

#### 2.1.2 字段对照

| 字段族 | CodeFlow 独有 | fcop 独有 | 共有（含语义差异） |
|---|---|---|---|
| 身份 | `agent_id`, `sdk_agent_id` | `code`, `label`, `session_id` | — |
| 角色/层 | `role`（mapped to roles.yaml）| — | `layer` enum `worker/governance/admin`（CodeFlow 与 fcop 同 enum） |
| 能力 | `skills: string[]` + 必含 `fcop`、`required_kernel` | `can[]`, `cannot[]`（boundary capability token） | — |
| 部署 | `node` (`local/cloud/mobile`), `runtime` (`local/cloud`), `workspace`, `model` | — | — |
| 运行态 | `status`, `current_task`, `current_session`, `memory_usage`, `started_at`, `last_active_at`, `labels` | — | — |

**没有任何字段是「同名同义但格式不同」** — 全部要么 CodeFlow 独有、要么 fcop 独有。**因此 drift 概念在这里不适用**。

#### 2.1.3 Charter 5.4 判定

> Charter 5.4：「CodeFlow 仍持有应用层涌现物（agent 运行态 PCB / SDK session 状态 / Windows EPERM retry）」

**CodeFlow `agent.schema.json` 100% 落在「应用层涌现物」**。`sdk_agent_id` / `node` / `runtime` / `model` / `memory_usage` 等字段全部是 Cursor SDK 适配 + runtime PCB 范畴，fcop 协议层不应该也不需要管这些。

fcop `agent.schema.json` 100% 落在「协议层角色 identity + capability」。`can` / `cannot` / boundary capability token 是 fcop 的 governance 层概念。

**两个 schema 不撞** — 分别住 `agents.json` 与 `fcop.json`，不冲突。

#### 2.1.4 v0.3 release ready?

✅ **Yes**。CodeFlow `agent.schema.json` 留在 `packages/codeflow-protocol/schemas/` 作 CodeFlow PCB SSOT。fcop `agent.schema.json` 由 fcop 持有，CodeFlow 不 mirror、不 import、不 wire（PM 第 15 次自披露已撤回 `AgentRegistry → fcop.list_agents` 计划，理由相同）。

---

### 2.2 `review.schema.json` — Dual contract

#### 2.2.1 字段对照

| 维度 | CodeFlow v0.1 | fcop@1.1.0 (v1.1) |
|---|---|---|
| `$schema` | draft-07 | draft 2020-12 |
| required | 6 (`protocol, review_id, subject_type, subject_ref, decision, decided_at`) | 9 (`+ version, type, reviewer_role`) |
| `decision` enum | 5 (`approved, rejected, needs_changes, abstained, needs_human`) | 5（同 — v1.1 ADR-0025 加 `needs_human`） |
| `subject_type` enum | 4 (`task, code_change, report, role_switch`) | 4（同 — 顺序略不同） |
| `human_approval` 子结构 | v0.1 stub: `pushed_to, pushed_at, approved_by, approved_at, trigger_reason` | v1.1 rich: `approver, decision, approved_at, channel, comment, evidence{device_id, ip, auth_method}` |
| `required_changes` | `string \| array \| null` | `array (minItems: 1 when needs_changes)` |
| `review_board` | ✅ CodeFlow 独有（v0.5+ 多 reviewer）| ❌ |
| `decision_duration_ms` | ✅ CodeFlow 独有 | ❌ |
| `subject` 字段 | ❌ | ✅ fcop 独有（human-readable label）|
| `allOf` 约束 | `needs_human → require human_approval` + `needs_changes → require required_changes` | `needs_changes → require required_changes (minItems: 1)` + `needs_human → 不要求 human_approval 立即存在`（pending semantics） |

#### 2.2.2 Day 3 实际 wire-up（v0.3 reality check）

Day 3 (TASK-20260511-011 / commit `ebb6656`) 已把 `ReviewWriter.write()` 走 fcop-first / yaml-fallback：

- **fcop 路径**（`fcopClient` injected）：通过 `fcop.Project.write_review$()` 持久化，**fcop@1.1.0 schema 是 SSOT**。Day 3 报告 §三 D3-S2 明示 fcop 拒绝 v0.1 stub `human_approval` block + 拒绝 `decision_duration_ms`。Day 3 已在 `_writeViaFcop` 内过滤掉 CodeFlow 独有字段。
- **yaml fallback 路径**（`fcopClient = null` 或 `FcopClientError`）：仍按 CodeFlow v0.1 `review.schema.json` 落盘，**CodeFlow schema 是 SSOT**。

#### 2.2.3 Charter 5.4 判定

`review` 是**双 contract**：

| 路径 | SSOT | 用途 |
|---|---|---|
| fcop bridge wired | `D:\FCoP\src\fcop\_data\schemas\review.schema.json` v1.1 | 主路径（v0.3.0-alpha 出厂默认）|
| yaml fallback | `packages/codeflow-protocol/schemas/review.schema.json` v0.1 | 降级路径（fcop 故障 / `CODEFLOW_SKIP_FCOP_PROBE=1`） |

两套 schema **不互相 mirror**，但 v0.3 wire-up 确保：
- 写入：`ReviewWriter._writeViaFcop()` 走 fcop（discards CodeFlow 独有字段，已 Day 3 TS-RW-D3-2 钉死契约）
- 写入：`ReviewWriter._writeYaml()` 走 v0.1 schema（含 CodeFlow 独有字段）

**这是 v0.3 故意保留的容错设计**（Day 3 报告 §三 详述）。

#### 2.2.4 v0.3 release ready?

✅ **Yes**。两 schema 都保留。CodeFlow v0.1 `review.schema.json` **重新定位为 "yaml fallback 契约"**，不是「fcop schema 的 mirror」。

#### 2.2.5 已知 break/divergence（DEV 提示运营方）

| 字段 | fcop 路径行为 | yaml fallback 路径行为 |
|---|---|---|
| `review_id` | fcop 自动生成（按 sequence-generator）| caller 自填 |
| `human_approval` | 写盘时不含此 block；后续 `markHumanApproved$()` 才填 | 写盘时即填 v0.1 stub `{pushed_to, pushed_at, approved_by: null, approved_at: null, trigger_reason}` |
| `decision_duration_ms` | 不持久化 | 持久化为 int / null |

Day 3 + Day 4 commit (`ebb6656` / `9506a91`) + `docs/releases/v0.3.0-alpha.md` §What's new §4-§5 已记录。

---

### 2.3 `skill.schema.json` — MCP registry vs role-capability reference

#### 2.3.1 字段对照

| 维度 | CodeFlow v0.1 (`schemas/skill.schema.json`) | fcop@1.1.0 (`_data/schemas/skill.schema.json`) |
|---|---|---|
| 概念 | **MCP server 注册表**（runtime 用来 mount MCP 子进程 + kernel dep check） | **角色能力引用**（agent 可调能力的 routing key） |
| required | 6 (`skill_id, version, provided_by, tools, available_to_roles, required_kernel`) | 1 (`id`) |
| `additionalProperties` | `false` | `true` |
| 主键 | `skill_id` (`^[a-z][a-z0-9_-]*$`) | `id` (`minLength: 1`) |
| `provided_by` | ✅ CodeFlow 独有 — `{type=mcp_server, transport=stdio/http/sse, command, url}` | ❌ |
| `tools[]` | ✅ 有 — `{name, required_perms, risk_level, irreversible, cost_sensitive}` | ✅ 有 — `{name, risk_level, irreversible, cost_sensitive, description}` |
| `required_kernel` | ✅ CodeFlow 独有 — 必含 `fcop@>=1.0` 之类 | ❌ |
| `available_to_roles` | ✅ CodeFlow 独有 | ❌ |
| `compatible_runtimes` | ✅ CodeFlow 独有 (`local/cloud`) | ❌ |
| `uri` | ❌ | ✅ fcop 独有 — `mcp://local/git` 之类 |
| `homepage`, `license` | ✅ CodeFlow 独有 | ❌ |

#### 2.3.2 概念错位（同名异义）

- CodeFlow `skill` 描述 **"如何启动 + 挂载这个 MCP server"**（runtime 视角）
- fcop `skill` 描述 **"这个能力在 fcop role-capability registry 里的索引"**（governance 视角）

`tools[]` 是唯一概念交叠区，但具体字段集略不同（CodeFlow `required_perms` vs fcop `description`）。

#### 2.3.3 Charter 5.4 判定

`skill` 落在 **「应用层涌现物」**：

- CodeFlow `SkillRegistry` + `KernelDependencyValidator` + `MCPInjector` 三件套（v0.1 起就有）依赖 CodeFlow `skill.schema.json`。fcop@1.1.0 没有「runtime 怎么启 MCP 子进程」的概念（fcop 是文件协议，不是 runtime）。
- fcop `skill.schema.json` 是给「角色 X 在 fcop.json 里声明拥有的能力」用，**与 CodeFlow runtime MCP layer 完全无关**。

#### 2.3.4 v0.3 release ready?

✅ **Yes**。CodeFlow `skill.schema.json` 留在 `packages/codeflow-protocol/schemas/` 作 MCP registry SSOT。fcop `skill.schema.json` 由 fcop 持有；CodeFlow 不 mirror、不 wire（与 `agent` 同样的 Charter 5.4 原则）。

---

## §三 综合 ownership matrix

| Schema | CodeFlow 持有 | fcop@1.1.0 持有 | v0.3 wire-up | Charter 5.4 类别 |
|---|---|---|---|---|
| `agent` | ✅ v0.1（PCB schema）| ✅ v1.1（role identity） | 未 wire — 两边独立 | **应用层涌现物**（CodeFlow PCB）|
| `task` | ✅ v0.1 | ❌（fcop 不管 task）| TaskParser 走 fcop bridge（Day 2 TASK-009）— fcop 自有 task schema 是 implicit (Project.write_task 自动校验) | **应用层涌现物**（Charter 5.4） |
| `review` | ✅ v0.1（yaml fallback 契约） | ✅ v1.1（主路径 SSOT） | ReviewWriter 走 fcop-first/yaml-fallback（Day 3 TASK-011）| **Dual contract**（v0.3 故意保留）|
| `session` | ✅ v0.1 | ❌（fcop 不管 session）| 不 wire — SessionManager 100% runtime 内部 | **应用层涌现物**（Charter 5.4）|
| `skill` | ✅ v0.1（MCP registry）| ✅ v1.1（role capability ref） | 未 wire — 两边独立 | **应用层涌现物**（CodeFlow MCP registry）|
| `boundary` | ❌ | ✅ v1.0 | 未 wire | fcop-only（governance）|
| `encoding` | ❌ | ✅ v1.0 | 未 wire | fcop-only（layout）|
| `event` | ❌ | ✅ v1.0 | 未 wire | fcop-only（FS event）|
| `failure` | ❌ | ✅ v1.0 | 未 wire | fcop-only（recovery）|
| `ipc-envelope` | ❌ | ✅ v1.0 | 隐式 wire（fcop 写 task/review 时自动生成 envelope）| fcop-only（transport）|

**统计**：
- 5 CodeFlow 持有 schemas（agent / task / review / session / skill）：4 是「应用层涌现物」+ 1 是「dual contract」
- 8 fcop@1.1.0 持有 schemas：3 与 CodeFlow 同名（agent / review / skill）+ 5 fcop-only
- **没有任何 schema 是「CodeFlow mirror fcop SSOT」**（这条规则在 v0.2.0-beta.3 之前都是 PM 想象的；真实情况是 v0.2 + v0.3 期间 CodeFlow 自己持有 5 schemas，从未 mirror）

---

## §四 actionable items（给 Day 5.2 / 5.3 / Day 6）

| # | Action | 对象 | 状态 |
|---|---|---|---|
| 1 | `types.ts` 顶部加 schema ownership matrix（5 行 markdown 表格）+ 修订 §5 SCOPE & RULES 关于 "single source of truth = fcop" 的过时声明 | `packages/codeflow-protocol/src/types.ts` | Day 5.2 |
| 2 | `types.ts` §3.2 Agent / §3.6 Skill 节点加 `// Charter 5.4: CodeFlow-owned PCB/MCP registry` 标注 | 同上 | Day 5.2 |
| 3 | `types.ts` §3.3 Task / §3.5 Session 节点加 `// Charter 5.4: CodeFlow-owned emergence schema` 标注 | 同上 | Day 5.2 |
| 4 | `types.ts` §3.4 Review 节点加 `// Dual contract: v0.3 fcop-first / yaml-fallback (see Day 3 ReviewWriter)` 标注 | 同上 | Day 5.2 |
| 5 | `docs/releases/v0.3.0-alpha.md` 追加 "Schema ownership (Charter 5.4)" 段 | release notes | Day 5.3 |
| 6 | 本报告链接进 `docs/releases/v0.3.0-alpha.md`（Day 6 ship 一起带上） | release notes | Day 5.3 |
| 7 | spike 文档 `p4-schema-mapping-v1.1.md` **不动**（历史快照原貌；本报告是「修订视角」）| — | — |
| 8 | **没有任何 schema 文件需要修改**（v0.3.0-alpha 出厂等于 Day 4 EOD baseline + 注释 + CHANGELOG）| — | — |

---

## §五 Surprise D5-S1（DEV 主动报警 — PM 第 19 次错位）

### 事实

PM TASK-017 §2.1 表格：

> | # | Schema | fcop@1.1.0 | CodeFlow | 关系 | Day 5 处理 |
> |---|---|---|---|---|---|
> | 1 | agent | ✅ | ✅ | **共同 — 需 drift 核验** | 5.1 |
> | 2 | review | ✅ | ✅ | **共同 — 需 drift 核验** | 5.1 |
> | 3 | skill | ✅ | ✅ | **共同 — 需 drift 核验** | 5.1 |

DEV-001 实测后判定：**3 个 schema 都不是「mirror — drift = bug」关系**（详见 §二）。

### 错位类型

- path 三件套（PM 自约束 9）已查 4 项：(1) `types.ts` 存在 / (2) `schemas/*.json` 5 个存在 / (3) `D:\FCoP\.../*.json` 3 个存在 / (4) `v0.3.0-alpha.md` 存在
- **缺失的第 5 件**：**「schema concept 是否真是 mirror」** — PM 没查这件。

实际上 spike 阶段 `p4-schema-mapping-v1.1.md` §2.2 / §2.3 已明示「同名异义」，PM 起草 TASK-017 §2.1 时没有 cite 这份 spike 文档，反而沿用 TASK-007 §四的「共同 — 需 drift 核验」叙事。

### 给 PM 的 emergence-log 启示

`path 版三件套` 已矩阵成熟，但 **「内容三件套」** 待建：

| 内容三件套维度 | 含义 | 第 19 次错位是哪件失守 |
|---|---|---|
| 1. 文件 path 存在 | ✅ 已 cover（path 版三件套）| — |
| 2. 文件可被解析（lint / JSON parse）| ⚠️ 部分 cover | — |
| 3. **文件「概念」与 PM 心智模型对齐**（schema 是否真是 mirror / 函数语义是否真是 PM 预期）| ❌ **未 cover** | **本次失守** |

建议 PM-01 在 emergence-log §3 第 19 次自披露时入档「**内容三件套**」作为 path 三件套的下一矩阵升级方向。具体到本次：**派 schema-related 任务前，应先 `Read` spike 阶段的 mapping 文档 + diff 一遍当前对比，再决定是 "drift verify" 还是 "concept clarify"**。

### DEV 处理

按 PM TASK-017 §9（DEV 高自由度声明）+ §5 path 三件套（DEV 派单后版自检）+ DEV 自约束「surprise self-discovery」：

- DEV 自决用 spike 文档 + 实测 JSON diff 重新框架 Day 5.1 工作（vs PM §3.1 的「drift 字段表格」叙事）
- 本报告 §二 / §三 / §四 / §五 公开记录这一框架修订
- 工作量并未因此增加（spike 文档已 do heavy lifting；本报告只是把 spike 结论 + Charter 5.4 视角整合到 release-ready 文档）
- DEV 不为 PM 错误买单（PM TASK-017 §1 已声明）

---

## §六 spike 文档与本报告的关系

| 文档 | 视角 | 何时写 | 状态 |
|---|---|---|---|
| `fcop/internal/p4-schema-mapping-v1.1.md` | spike — fcop 1.1.0 + CodeFlow v0.1 字段全量 diff（informal）| 2026-05-11 上午 / TASK-005 | **不动**（历史快照） |
| **`fcop/internal/p4-day5-schema-drift.md`（本文）** | Day 5 — Charter 5.4 视角 + release-ready ownership matrix | 2026-05-11 下午 / TASK-017 | **新建** |
| `docs/releases/v0.3.0-alpha.md` | Day 4-6 — v0.3.0-alpha release notes | 2026-05-11 / TASK-013 baseline + TASK-017 §5.3 追加 + Day 6 ship 最终化 | DRAFT，Day 5.3 追加 |

---

— DEV-001, 2026-05-11 (Day 5)
