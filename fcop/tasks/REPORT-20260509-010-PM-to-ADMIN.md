---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-010
sender: PM
recipient: ADMIN
priority: P0
thread_key: codeflow-pwa-pre-s3-housekeeping
references:
  - REPORT-20260509-009-PM-to-ADMIN
---

# Sprint S3 启动前 — 项目状态盘点 + 3 类整理方案

> ADMIN 5/9 11:20 指示：「现在码流项目的 fcop 环境和角色配置要先确定；而且以前的 task 有很多，也要归档；这样后续开发项目就不乱了！」
>
> 这是一份 **盘点 + 提案** 报告，不是 *派单 + 执行*。PM 在你拍板前不动任何文件。

## 一、盘点结果（3 维度）

### 1.1 fcop 环境现状（A）

| 维度 | 现状 | 评价 |
|---|---|---|
| 本仓 `mcp.json` 文件 | **0 个**（5/9 删 `codeflow-plugin/mcp.json` 后已清零）| ✅ 干净 |
| 本仓 `fcop-mcp/` 子目录 | **不存在**（5/9 已删）| ✅ 干净 |
| 本仓 `codeflow-plugin/src/fcop/` 副本 | **不存在**（5/9 已删）| ✅ 干净 |
| `.cursor/mcp.json` 是否存在 | **不存在** | ⚠️ 这意味着本仓自己跑 cursor agent 时没装 fcop-mcp |
| 你（ADMIN）实际用什么连 fcop-mcp？| **未知** —— 可能在用户级 `~/.cursor/mcp.json`，可能在 D:\FCoP 里有 mcp.json | ⚠️ 需要确认 |
| `D:\FCoP/mcp.json` | 未盘点（不在本仓，按硬规则 #5 不该由本仓读写）| ✅ 边界正确 |
| `packages/codeflow-protocol/` 对 fcop 的依赖 | **0 个**（纯 TS schema mirror）；body 中 `peerDependencies: { fcop: ">=1.1.0" }` 仅是未来计划 | ✅ 干净 |
| `_ignore/audit_fcop_*.{json,py}` 残留 | 4 个文件（`audit_fcop_project.{json,py}` + `audit_legacy_fcop.{json,py}`）| ⏳ §8.6 backlog #6 |

**结论 A**：本仓 fcop 环境**已经按硬规则 #5 干净化**。唯一 gap = ADMIN 实际工作流（你打开 Cursor 时用什么 mcp 配置接 fcop-mcp）没在本仓内任何文件里有记录——但这正是 #5 想要的（用户的 mcp.json 在用户家，不在仓里）。

### 1.2 角色配置现状（B）

3 个地方都有"角色信息"，**互相不同步**，是重要 gap：

| 来源 | 路径 | 内容 | 谁在用 |
|---|---|---|---|
| **`.cursor/rules/`（强约束）** | `admin-human-bridge.mdc` / `pm-bridge.mdc` / `dev-bridge.mdc` / `ops-bridge.mdc` / `qa-bridge.mdc` + `qa-team-{lead,tester,perf-tester,auto-tester}.mdc` + `codeflow-project.mdc`，每个 ×2 语言 = 14 个 mdc | 角色行为规则（接收源、回执格式、技术约束）| Cursor agent 自动应用，**最强制** |
| **`docs/agents/{ROLE}-01.md`（说明性）** | `ADMIN-01.md` / `PM-01.md` / `DEV-01.md` / `OPS-01.md` / `QA-01.md` ×2 语言 = 10 个 md | 角色定位 + 职责说明 | 人类阅读，agent 偶尔参考 |
| **`codeflow-plugin/agents/`（v1 brief 素材库）** | `dev-team/{pm,dev,ops,qa}.md` + `media-team/{collector,writer,editor,publisher}.md` + `mvp-team/{builder,designer,marketer,researcher}.md` + `_shared/collaboration.md` = 13 个 md | v1 时代的 role brief，4 个团队模板 | v1 plugin 用（plugin 已删，但 brief 还在）|
| **`roles.yaml`（设计文档 §2.2 目标）** | `.codeflow/config/roles.yaml` | layer / brief_dir / model 配置 | ❌ **不存在** |
| **`.codeflow/` 标准目录** | `.codeflow/briefs/` / `.codeflow/state/` / `.codeflow/config/` | 设计文档目标格式 | ❌ **不存在** |

**结论 B**：
- ✅ 当前 dev-team（PM/DEV/OPS/QA + ADMIN）的角色 *规则* 是清晰的（`.cursor/rules/*-bridge.mdc` 是单点权威）
- ✅ 当前角色 *说明* 是清晰的（`docs/agents/{ROLE}-01.md`）
- ⚠️ 角色 *brief*（agent 启动时载入的初始上下文）来源混乱：v1 留下的 `codeflow-plugin/agents/` 还在，但路径不再合理（plugin 已删）
- ⚠️ `roles.yaml` + `.codeflow/` 标准格式还没建（这是 Sprint S3 的事）

### 1.3 tasks/ 历史文件清点（C）

总数：**54 个 .md** 在 `docs/agents/tasks/`

按时间分组：

| 时段 | 数量 | 状态 | 是否可归档 |
|---|---|---|---|
| 2026-04-03 ~ 2026-04-08 | 2 | v1 时代旧命名（`PM01-to-ADMIN01` 等）| ✅ 可归档 |
| 2026-04-20 ~ 2026-04-25 | 27 | v1 时代 thread，全部已闭环 | ✅ 可归档 |
| 2026-05-09（今天）| 12 | v2 工作 | ⚠️ 部分待归档（见下） |
| `docs/agents/tasks/README.md` | 1 | tasks/ 目录的说明文件 | ❌ 不归档 |

**5/9 的 12 个文件按 thread 状态**：

| thread_key | 文件 | 状态 |
|---|---|---|
| `sdk-spike` | TASK-001 + REPORT-001 | ✅ Sprint S1 完成 |
| `runtime-skeleton` | TASK-002 + REPORT-002 | ✅ Sprint S2 完成 |
| `fcop-issue-decision` | TASK-003 ADMIN-to-PM + TASK-004 PM-to-ADMIN + REPORT-003 + REPORT-009 | ✅ Issue #2 已推送 = 闭环 |
| `fcop-mcp-rename` | **TASK-005 PM-to-DEV** | ⚠️ **superseded** — 5/9 整个 plugin 被瘦身后，重命名变成"已删除"；该任务实际被 TASK-006 覆盖，DEV 没有出 REPORT |
| `rule5-purge` | TASK-006 + REPORT-006 + REPORT-007 + REPORT-008 + REPORT-010（本文件）| ✅ 闭环（含本文件）|

**结论 C**：
- 29 个 v1 时代 tasks → 全部可归档
- 11 个 5/9 v2 任务 → 已闭环
- 1 个 5/9 任务（TASK-005）= **被 TASK-006 取代** → 需要标记为 superseded（不归档前先打个戳）
- 1 个 README.md 留 tasks/ 根

## 二、3 类整理方案（请 ADMIN 选）

### 2.1 方案 A — fcop 环境锁定

| 选项 | 做什么 | 工作量 | 推荐度 |
|---|---|---|---|
| **A1（最小）** | 只在 `docs/integrations/fcop-standalone-zh.md` 中加一段「本仓 contributor 应当如何接 fcop-mcp」的引用片段（指向 D:\FCoP 上游 README）| ~10 分钟 | ⭐⭐⭐ |
| **A2（中度）** | A1 + 新建 `docs/setup/fcop-mcp-for-codeflow-dev.md` —— 手把手教**码流贡献者**（不是终端用户）如何在 *自己* 的 `~/.cursor/mcp.json` 里挂 fcop-mcp + 验证步骤 | ~30 分钟 | ⭐⭐ |
| **A3（重度）** | A1 + A2 + 在本仓建 `_dev/.cursor/mcp.json.example`（开发者样例文件，非真实配置）| ~45 分钟 | ⭐ |

**PM 推荐 A1**：现在阶段最重要的是 **不破坏硬规则 #5**。任何"在本仓内告诉用户怎么装"的内容都接近 §5.b 的 ⛔ 红线。A1 的措辞要严守"指引到 D:\FCoP，不在本仓重复定义"。

### 2.2 方案 B — 角色配置锁定

| 选项 | 做什么 | 工作量 | 推荐度 |
|---|---|---|---|
| **B1（最小）** | 仅写一份 `docs/agents/CURRENT-ROLES.md`，把 3 个分散来源（`.cursor/rules/`、`docs/agents/{ROLE}-01.md`、`codeflow-plugin/agents/`）清晰列表对应起来；不动任何文件 | ~20 分钟 | ⭐⭐⭐ |
| **B2（中度）** | B1 + 新建 `roles.yaml`（按设计文档 §2.2 格式）作为"现状快照"，但 *暂时* 只描述当前 dev-team（PM/DEV/QA/OPS/ADMIN），不引入 §3.2 的 layer 字段（那是 FCoP Issue #2 通过后才合法）| ~45 分钟 | ⭐⭐ |
| **B3（重度）** | B1 + B2 + 把 `codeflow-plugin/agents/dev-team/*` 物理迁移到 `.codeflow/briefs/`（§8.6 backlog #5）| ~1.5 小时 | ⭐ |

**PM 推荐 B1**：B2 包含 `roles.yaml` —— 即使我们刻意不写 layer 字段，建一个 `.codeflow/config/roles.yaml` 仍可能被读者误解为"在 v0.1 之前就建立 v2 状态格式"，造成 v1/v2 混淆。B1 是纯文档归集，零风险；B2/B3 等 FCoP Issue #2 闭环 + Sprint S3 启动一并做。

### 2.3 方案 C — tasks/ 历史归档

| 选项 | 做什么 | 工作量 | 推荐度 |
|---|---|---|---|
| **C1（最小）** | 在 `docs/agents/tasks/` 下建 `_archive/2026-04/`，把 29 个 v1 时代 tasks 整体 `git mv` 进去；TASK-005 加一行"superseded by TASK-006" 注释；写一份 `_archive/README.md` 说明归档规则 | ~30 分钟 | ⭐⭐⭐ |
| **C2（中度）** | C1 + 把已闭环的 5/9 thread（sdk-spike / runtime-skeleton）也归档到 `_archive/2026-05/closed/`，只留 `fcop-issue-decision` / `rule5-purge` / `pre-s3-housekeeping`（active）| ~45 分钟 | ⭐⭐ |
| **C3（重度）** | C1 + C2 + 按 thread_key 重组：每个 thread 一个子目录（例如 `_archive/2026-04/v1-installer-fix/`），便于按业务主题查找 | ~1.5 小时 | ⭐⭐ |

**PM 推荐 C1**：核心目标是"tasks/ 根目录干净"。C1 已实现这个目标。C2 太激进（5/9 的 thread 离今天太近，可能还会有人引用）。C3 在 tasks 数量超过 100 之前不必要。

## 三、PM 推荐组合：A1 + B1 + C1

| 类别 | 选择 | 总工作量 |
|---|---|---|
| fcop 环境 | A1（接入指引片段）| 10 分钟 |
| 角色配置 | B1（CURRENT-ROLES.md 归集）| 20 分钟 |
| tasks 归档 | C1（_archive/2026-04/ + TASK-005 superseded 注释）| 30 分钟 |
| **合计** | | **~60 分钟** |

**这个组合的核心特点**：
- ✅ 全部是 *归集 / 注释 / git mv* —— 不引入新 schema、不创建 v2 格式（避免与未闭环的 FCoP Issue #2 + Sprint S3 冲突）
- ✅ 不破坏硬规则 #5（不在本仓 ship fcop 安装/分发素材）
- ✅ 完成后 `docs/agents/tasks/` 根目录只剩 ~13 个 active 文件 + README.md，肉眼一目了然
- ✅ 完成后 PM 写 `REPORT-011-PM-to-ADMIN.md` 汇报盘点完成 → Sprint S3 可启动

## 四、PM 不动手清单（你拍板前 PM 不做的事）

下列动作 PM **不会**擅自执行，必须 ADMIN 显式同意：

1. ❌ 移动任何 `docs/agents/tasks/` 下的文件
2. ❌ 创建 `roles.yaml` 或 `.codeflow/` 任何子目录
3. ❌ 物理迁移 `codeflow-plugin/agents/` 任何 brief
4. ❌ 删除 `_ignore/audit_fcop_*.{json,py}` 4 个文件
5. ❌ 修改 `.cursor/rules/` 任何 mdc（这是 Cursor agent 强约束，改一处影响所有会话）

## 五、请 ADMIN 拍板（一句话即可）

| 决策点 | 选项 | PM 默认建议 |
|---|---|---|
| **D1**：fcop 环境整理范围 | A1 / A2 / A3 / 跳过 | **A1** |
| **D2**：角色配置整理范围 | B1 / B2 / B3 / 跳过 | **B1** |
| **D3**：tasks 归档范围 | C1 / C2 / C3 / 跳过 | **C1** |
| **D4**：执行节奏 | (a) 现在立刻三件一起做（~60 分钟）; (b) 一次只做一件; (c) 攒到下一会话做 | **(a) 一起做** |
| **D5**：是否先 commit 当前未提交改动再开始整理 | (yes) / (no, 整理完一起 commit) | **(yes)** —— 把今天上午宪法块 + Issue #2 + 9 删的"硬规则 #5 闭环"作为独立 commit，整理工作另开 commit，git history 更清晰 |

如果你 OK 我的默认建议（A1+B1+C1+一起做+先 commit），回复"按推荐做"即可，PM 立刻派单 + 执行。

## 文件清单（本轮新增）

- 新增：`docs/agents/tasks/REPORT-20260509-010-PM-to-ADMIN.md`（本文件）
- 未修改其他文件 ✅
