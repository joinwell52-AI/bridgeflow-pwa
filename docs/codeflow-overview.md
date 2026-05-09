# CodeFlow AI Runtime / AI OS

> **草稿 v0.1**（对外速读版 · ADMIN-01 起草，2026-05-09）
>
> English version: [`docs/codeflow-overview.en.md`](./codeflow-overview.en.md)
>
> **这是什么？**
> 一份让 *第一次接触 CodeFlow 的人* 在 5 分钟内理解项目定位、思想、架构与路线的对外速读文档。
>
> ### 📜 项目宪法（ADMIN 5/9 双总纲句，原话锁定）
>
> 1. ADMIN 5/9 10:48 — 「**这个项目文件就是码流的，目前项目是用 cursor 的 sdk，应用 fcop-mcp。**」（身份 + 技术栈）
> 2. ADMIN 5/9 10:51 — 「**码流是做成一个 CodeFlow 的真正定位：一个面向多 Agent 协作开发的轻量级 AI Runtime / AI OS。**」（真正定位）
>
> 详细解读 + 与下方英文 tagline 的对应关系：见 [设计文档 §0.0](./design/codeflow-v2-on-fcop-sdk.md)。
>
> **官方定位（与设计文档一致）：**
>
> > **CodeFlow AI Runtime**
> > *A lightweight AI Operating Runtime for multi-agent software development.*
> > *Mobile-first AI Runtime for governable multi-agent software development.*

### 本文 vs 设计文档：什么时候看哪个？

| 你是谁 / 你想做什么 | 看哪份 |
|---|---|
| 5 分钟想搞清楚 CodeFlow 是什么 | **本文（overview）** |
| 给非技术读者 / 决策层 / 投资人讲 | **本文（overview）** |
| 想动手实现 / 写代码 / 定 sprint | [设计文档](./design/codeflow-v2-on-fcop-sdk.md)（约 1900 行） |
| 想找具体字段 / schema / API | 设计文档 §3 |
| 想看下周做什么 | 设计文档 §10 |
| 想知道为什么这么设计 | 设计文档 §0.5 / §0.6 / §0.7 |

> **改动同步规则：**
>
> - 改"对外讲什么、产品定位、给非技术读者看的叙事" → 改本文件
> - 改"怎么实现、字段定义、sprint 计划、技术决策" → 改设计文档
> - 同一概念两边都出现 → **设计文档是 source of truth，本文件是简化叙事**

---

## 一、定位（Positioning）

### CodeFlow 是什么？

CodeFlow **不是**：

- AI 聊天工具
- Cursor 插件
- 自动代码生成器

CodeFlow 的真正定位：

> 一个面向多 Agent 协作开发的**轻量级 AI Runtime / AI OS**。

### 核心目标

解决：

> **多个 AI Agent 无法长期稳定协作** 的问题。

包括：

- Agent 漂移
- 状态丢失
- 无法审计
- 长任务混乱
- 无治理机制
- 无状态恢复

---

## 二、核心思想（Core Philosophy）

### 1. AI 必须"状态外部化"

传统 Agent：

> 状态存在上下文

问题：

- 不稳定
- 易丢失
- 不可审计

CodeFlow：

> AI 状态 → 文件化 → 协议化 → 可治理

### 2. 协议驱动（Protocol-driven）

CodeFlow **不依赖**：

- 单一模型
- 单一 IDE
- 单一 Agent

而是：

> 通过 **FCoP 协议** 约束 Agent 行为

### 3. AI 需要治理（Governance）

企业真正需要的不是：

> 更自由的 AI

而是：

> **可审计、可恢复、可治理的 AI**

---

## 三、系统架构（Architecture）

```text
                ┌────────────────┐
                │ Mobile Console │
                └───────┬────────┘
                        ↓
                ┌────────────────┐
                │ CodeFlow Runtime│
                └───────┬────────┘
        ┌───────────────┼──────────────┐
        ↓               ↓              ↓
 ┌────────────┐ ┌────────────┐ ┌────────────┐
 │ Task Store │ │ Agent Core │ │ Review Sys │
 └────────────┘ └────────────┘ └────────────┘
                        ↓
                ┌────────────────┐
                │ Skill Runtime  │
                └───────┬────────┘
                        ↓
             ┌────────────────────┐
             │ Cursor / Claude SDK│
             └────────────────────┘
```

---

## 四、核心模块

### 1. Runtime Core

核心职责：

- 管理任务生命周期
- 管理 Agent Session
- 调度 Agent
- 控制状态流转
- 恢复异常任务

#### Runtime 状态机

```text
INIT
 ↓
PLANNED
 ↓
EXECUTING
 ↓
REVIEWING
 ↓
APPROVED / REJECTED
 ↓
DONE
```

> **对外认知态 ↔ 内部协议态映射**（实现时见设计文档 §3.3 Task Schema）：
>
> | 对外（本文） | 内部（FCoP / Task Schema） |
> |---|---|
> | INIT | (Task 文件未创建) |
> | PLANNED | `pending` |
> | EXECUTING | `dispatched` → `in_progress` |
> | REVIEWING | `review` |
> | APPROVED → DONE | `done` |
> | REJECTED | 回 `in_progress`，循环 ≤ N 次 |
> | (异常) | `blocked` / `cancelled` |

### 2. Task System

> **唯一硬规则：所有任务必须文件化。**
> 没有写到文件里的事，等于没发生。

CodeFlow 的 Task 形态分两个阶段：

#### 现状（v0.1，与 FCoP 完全兼容）

每条 Task 是一份独立 Markdown 文件，按"发起方 → 接收方"命名：

```text
docs/agents/tasks/
├── TASK-20260509-001-PM-to-DEV.md       ← Task 本体
├── REPORT-20260509-001-DEV-to-PM.md     ← 执行回执
└── REVIEW-20260509-001-QA-on-TASK-001.md ← 审计结论
```

这种"filename = protocol"是 FCoP 的核心约定，所有 v0.1 实现必须 100% 兼容它。详见设计文档 §3.3。

#### 目标形态（v0.x+，Task-as-folder）

随着任务规模上升（一个 Task 可能产出 plan / execution / result 多份产物），将演进到目录化结构：

```text
tasks/
 └── TASK-001/
      ├── task.md         # Goal + Constraints
      ├── plan.md         # PM 拆解
      ├── execution.md    # DEV 实施记录
      ├── result.md       # 最终产物索引
      └── review.md       # Review 决议
```

> ⚠️ **v0.1 不强制目录化**——演进路径保持向后兼容：单文件 Task 与目录化 Task 共存，文件级元数据（YAML front-matter）保持一致即可。

#### `task.md` 示例

```markdown
# Goal
实现用户登录功能

# Constraints
- 使用 JWT
- 不允许修改数据库结构
```

#### `review.md` 示例

```markdown
# Review

## Security
✅ 无危险操作

## Architecture
⚠️ 需要增加 token 过期机制
```

### 3. Agent Runtime

CodeFlow **不追求**：

> 万能超级 Agent

而是：

> **专业角色 Agent**

#### 示例

- PM Agent
- DEV Agent
- REVIEW Agent
- TEST Agent
- ARCHITECT Agent

#### Agent Schema

```json
{
  "agent_id": "DEV-01",
  "role": "developer",
  "status": "running",
  "task_id": "TASK-001"
}
```

### 4. Review Engine（核心）

CodeFlow 的核心之一：

> **AI 必须被审计**

#### 第一阶段

规则审计：

```text
禁止：
- DELETE
- DROP
- rm -rf
```

#### 第二阶段

AI Review：

- 是否符合任务目标
- 是否存在风险
- 是否出现漂移

### 5. Session Runtime

未来支持：

- Cursor
- Claude Code
- Codex
- VSCode Agent

Session 不再是：

> 聊天窗口

而是：

> **长期运行 Agent 进程**

---

## 五、移动端（Mobile Governance）

CodeFlow 最大特点之一：

> **AI Runtime 可被手机治理。**

手机端**不是**聊天框，而是：

> **AI Team Console**

### 手机端功能

#### Task 查看

```text
TASK-001
状态：Reviewing
负责人：DEV-01
```

#### Agent 状态

```text
DEV-01：运行中
REVIEW-01：审计中
```

#### Admin 审批

```text
⚠️ 高风险操作：
是否允许执行？
```

#### Emergency Stop

```text
🛑 停止所有 Agent
```

---

## 六、FCoP 的意义

FCoP **不是 Prompt**。

而是：

> **AI Runtime Protocol**

### FCoP 提供：

- Task 协议
- 状态协议
- Review 协议
- Agent 协议
- 协作协议

### 目标

实现：

> **不同 Agent 之间稳定协作**

---

## 七、未来方向（Roadmap）

> 本节是**对外粗粒度路线图**（4 档）。工程执行用的细粒度 sprint 计划（v0.1 → v1.0 五档、共 ~26 周）见设计文档 [§10 实施路线图](./design/codeflow-v2-on-fcop-sdk.md#10-实施路线图roadmap--sprint-plan)。

### v0.1 — Backend Kernel（约 6 周）

目标：

> **本地零 UI 跑通：PM → DEV → REVIEW → DONE 文件化闭环**

实现：

- Task Runtime
- Review Engine（核心）
- Session 持久化
- 进程崩溃后自动恢复

不做：手机端 / 云端 / Skill 市场 / 企业权限 / 任何 GUI。

[详见设计文档 §10.2](./design/codeflow-v2-on-fcop-sdk.md#102-v01-backend-kernel6-sprint每-sprint-1-周)

### v0.2 — Mobile Governance（约 4 周）

目标：

> **AI 24h 跑、ADMIN 在沙发上能审批 + 急停**

增加：

- Mobile Console（4 屏：Task Flow / Agent 状态 / Audit / Approval）
- Human-in-the-loop（高风险操作必经 mobile approval）
- 🛑 Emergency Stop

不做：云端节点（推后到 v0.3 或更后）/ Mobile 上写 Task / 多设备同步。

> ℹ️ 对外讲也可以把 v0.2 叙述为"Mobile + 多设备"，但工程交付以设计文档 §10.3 为准。

[详见设计文档 §10.3](./design/codeflow-v2-on-fcop-sdk.md#103-v02-mobile-governance-mvp4-sprint)

### v0.3 / v0.5 — 治理深化

| 版本 | 主题 | 关键能力 |
|---|---|---|
| **v0.3** | AI Patrol | PATROL Agent 巡检 5 类异常（漂移 / 卡死 / 越权 / 长期无响应 / 协议违规） |
| **v0.5** | Review Board | REVIEW + SECURITY + AUDIT 三角共识，单 reviewer 不能放行高风险 Task |

[详见设计文档 §10.4 / §10.5](./design/codeflow-v2-on-fcop-sdk.md#104-v03-ai-patrol3-sprint)

### v1.0 — Schema Freeze + 第一批外部用户（约 9 周窗口）

目标：

> **冻结 Runtime Protocol（5 类 schema），让生态可以基于协议生长**

判定标准（4 选 3）：≥3 个第三方实现接入 / 90 天无 breaking change / ≥1 篇 Essay 总结协议演化 / 通过 schema fuzz 测试。

[详见设计文档 §10.6](./design/codeflow-v2-on-fcop-sdk.md#106-v10-schema-freeze--第一批外部用户9-周窗口)

### Long-term

继续演化为：

> **AI Operating System** —— 详见 §八 长期愿景

---

## 八、长期愿景（Vision）

未来企业工作流：

```text
Human
  ↓
CodeFlow Runtime
  ↓
Multiple AI Agents
  ↓
Business Systems / IDE / Cloud
```

而不是：

```text
Human → ERP → Manual Operation
```

### 为什么 AI OS 可能就是"下一代 ERP"？

ERP 的本质是 *"让一群人围绕业务流程稳定协作"*；AI OS 的本质是 *"让一群 AI 围绕业务流程稳定协作"*。

| 维度 | 传统 ERP | AI OS（CodeFlow 的终局形态） |
|---|---|---|
| 协作主体 | 人 + 流程 + 表单 | AI Agent + 协议 + Task 文件 |
| 状态载体 | 数据库 + 工单系统 | FCoP 文件 + Runtime 状态 |
| 治理机制 | 审批流 / 权限矩阵 | Review Engine + Human-in-the-loop |
| 人介入点 | 大部分操作 | 高风险决策点（Mobile approval） |
| 可观察性 | BI 报表 | Runtime 事件流 + Audit log |

并不是说 AI OS 一定要"替代"ERP——更现实的演进是：**AI OS 把 ERP 里"人执行流程"的那部分稀释掉**，ERP 退化成被 AI Agent 调用的业务系统之一。

详见设计文档 [§0.6.6 终局：AI OS 可能就是下一代 ERP](./design/codeflow-v2-on-fcop-sdk.md)。

---

## 九、核心理念总结

> AI 的问题从来不是"不够聪明"。
>
> 而是：
>
> **"无法长期稳定协作与运行"。**

CodeFlow 的目标：

> 为 AI 团队提供 **Runtime、Protocol 与 Governance**。

---

## 想看更深？按角色跳转

| 你想了解的事 | 跳到设计文档的哪一节 |
|---|---|
| 1 屏速读卡 | [§0.0 Executive Summary](./design/codeflow-v2-on-fcop-sdk.md#00-executive-summary1-屏读完) |
| 为什么这么做（AI OS 雏形 / 三层栈 / 护城河） | §0.5 / §0.6 / §0.7 |
| 第一阶段做什么 / 不做什么 | §0.8 First-phase scoping |
| Mobile 怎么做 governance（4 屏 / HITL / Emergency Stop） | §0.9 Mobile-first Governance |
| 5 类 Runtime Schema（Agent/Task/Review/Session/Skill） | §3 Runtime Protocol |
| 第几个 sprint 干什么 | §10 实施路线图 |
| 想跑起来一个 demo | §0.8.3 Hello World 验收脚本 |

---

## 文档关系图

```text
docs/
├── codeflow-overview.md            ← 你现在在这里（对外速读，~5 分钟）
└── design/
    └── codeflow-v2-on-fcop-sdk.md  ← 完整设计文档（~1900 行，~60 分钟）
```

---

## 5 分钟自测清单（你真的读懂了吗？）

读完这一页后，你应该能在不查文档的情况下回答下面 5 个问题。如果有任何一题答不上来，回去对应章节再读一遍。

| # | 问题 | 在哪一节 |
|---|---|---|
| 1 | CodeFlow **不是**什么？为什么强调"不是 Cursor 插件"？ | §一 |
| 2 | "AI 状态外部化"是什么意思？没有它会出什么问题？ | §二.1 |
| 3 | Review Engine 为什么被列为"核心之一"？没有它跟普通 Agent 框架的差别在哪？ | §四.4 |
| 4 | 为什么 Mobile 不是聊天框，而是"AI Team Console"？ | §五 |
| 5 | v0.1 的*唯一*目标是什么？跑不通 v0.1 能不能直接做 v0.2？ | §七 v0.1 |

**奖励题**（理解到这一层就达到决策层水平了）：

- 6. 为什么说 CodeFlow 真正的护城河是 *Agent Governability（Agent 可治理化）*，而不是 UI / Prompt / 模型？→ 设计文档 §0.6.7
- 7. 为什么 v2 的核心交付物不是"应用"，而是 5 类 Schema？→ 设计文档 §3 + §0.6.8（Docker 前夜类比）

---

> **回到顶部需要做点什么？**
>
> 这页文档每次大改后请**同步检查 §0.0 Executive Summary**（设计文档最前的速读卡）——
> 这两份文档共同构成 CodeFlow v2 的"对外形象"。任何核心概念变动（定位 / 护城河 / Roadmap 节奏 / Mobile 形态），两边必须一起改。
