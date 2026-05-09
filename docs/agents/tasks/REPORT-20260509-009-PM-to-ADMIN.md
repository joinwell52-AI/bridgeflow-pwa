---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-009
sender: PM
recipient: ADMIN
priority: P0
thread_key: codeflow-pwa-charter-and-fcop-proposal
references:
  - REPORT-20260509-008-PM-to-ADMIN
  - TASK-20260509-003-ADMIN-to-PM
  - TASK-20260509-004-PM-to-ADMIN
---

# 双指令完成 — 宪法块 5 文件嵌入 + D:\FCoP Issue #2 已推送

## ADMIN 5/9 11:14 双指令

> 「嵌入吧；推 D:\FCoP Issue」

PM-01 把这一条解读为两条独立动作并并行执行：
- Track A：精简版宪法块嵌入 5 个外部曝光文档
- Track B：`gh issue create` 推 D:\FCoP（昨晚 Option A + 今早第二次确认 = 完成两次确认门槛）

## Track A — 5 文件嵌入完成 ✅

| # | 文件 | 改动 | Lint |
|---|---|---|---|
| 1 | `README.md` | 顶部 v2 入口块升级为「Project Charter / 项目宪法」双语块 + 引向设计文档 §0.0 | ✅ 0 错误 |
| 2 | `README.en.md` | 同上（纯英文版本） | ✅ |
| 3 | `README.zh.md` | 同上（纯中文版本） | ✅ |
| 4 | `docs/codeflow-overview.md` | 在「官方定位」块上方嵌入「项目宪法」块（含 ADMIN 5/9 10:48+10:51 两条原话） | ✅ |
| 5 | `docs/codeflow-overview.en.md` | 同上（含原话英译 + 指回设计文档查中文原话） | ✅ |

设计原则：**外部文档放精简表述 + 指向设计文档查完整原话**。避免在多处复制原话造成 drift；设计文档 §0.0 仍是 *single source of truth*。

## Track B — D:\FCoP Issue #2 已推送 ✅

| 字段 | 值 |
|---|---|
| **URL** | <https://github.com/joinwell52-AI/FCoP/issues/2> |
| **Number** | #2 |
| **Title** | `Proposal: Runtime governance fields for fcop@1.1`（48 字符，符合 self-check ≤ 80） |
| **State** | OPEN |
| **Posted at (UTC)** | 2026-05-09T03:18:16Z |
| **Posted by** | `joinwell52-AI` 账号（已登录的 gh）|
| **Body length** | ~210 行 markdown，包含 5 个 ADR field + delivery plan + 4 questions + references |
| **Verification** | `gh issue view 2 --repo joinwell52-AI/FCoP --json ...` 返回 OPEN ✅ |
| **Posted command** | `gh issue create --repo joinwell52-AI/FCoP --title "..." --body-file _ignore/fcop-issue-body.md` |

## ADMIN 之前定的 4 条约束 — 全部满足

| # | 约束 | 兑现 |
|---|---|---|
| 1 | `gh issue create` 前需 ADMIN 二次确认 | ✅ 5/9 11:14「推 D:\FCoP Issue」即第二次确认 |
| 2 | Issue 提案 5 个 ADR 全包含 | ✅ Field 1-5 全部进 body |
| 3 | 暂时不在本仓动 schema | ✅ `packages/codeflow-protocol/` 5 个 schema 文件本轮无任何改动；body 中 `pending-fcop-review` 状态承诺也保留 |
| 4 | 不动 D:\FCoP 上游仓的代码（仅 Issue） | ✅ 仅创建 Issue；未 push 任何 commit；未触碰 main 分支 |

## 自检

- ✅ 5 文件 ReadLints 0 错误
- ✅ Issue body 内容 = `_ignore/fcop-issue-body.md`，是从 `_ignore/fcop-issue-draft.md` 抽取干净版本（去掉本地 wrap + 本地 metadata）
- ✅ Issue self-check 8 条全通过（标题 ≤ 80 / 5 schema additive / 无 codeflow-* 前缀 / 无 secret / body 长度合理 / 跨链可访问 / 问题清单清晰 / 自我克制声明在尾）
- ✅ `_ignore/fcop-issue-draft.md` 末尾 metadata 已回填（posted_at / issue_url / issue_number / posted_command / admin_authorization 双授权来源 / state_at_post）
- ✅ 全程未触碰 git config / 未改 D:\FCoP 文件 / 未推 commit

## 文件清单（本轮新增/修改）

修改：
- `README.md`（顶部 6 行替换为宪法块 + v2 入口块组合）
- `README.en.md`（同上，英文版）
- `README.zh.md`（同上，中文版）
- `docs/codeflow-overview.md`（"官方定位"块上方插宪法块）
- `docs/codeflow-overview.en.md`（同上）
- `_ignore/fcop-issue-draft.md`（metadata 回填）

新增：
- `_ignore/fcop-issue-body.md`（Issue 实际推送的干净 body 副本，留作审计）
- `docs/agents/tasks/REPORT-20260509-009-PM-to-ADMIN.md`（本文件）

## 影响 ADMIN 的部分

| 维度 | 影响 |
|---|---|
| 你打开 GitHub 仓首页（任何语言） | 第一屏看到宪法块 ✅ |
| 你打开 codeflow-overview（任何语言） | "官方定位"上方先看到宪法块 + ADMIN 原话 ✅ |
| FCoP 上游协作 | 现在球在 FCoP maintainers 那里 — 等他们对 4 个问题回应 |
| FCoP 仓首页 issue 列表 | 多了一条 #2，状态 OPEN |
| 本仓 `packages/codeflow-protocol/` 是否被动 | ❌ 没动 — Issue body 里"在 FCoP 评审通过前不在 consumer 端动 schema"的承诺保住 |

## 我现在等什么？

**主动等待**：FCoP maintainers 对 Issue #2 的回应（4 个 questions）。预计窗口：几天到 1-2 周。

**被动可做**：
- ⏳ Sprint S3 准备（v0.1 backend kernel 下一步），但 §3 Schema 任何改动都要 *先等 FCoP Issue #2 闭环*
- ⏳ §8.6 backlog #4: `docs/integrations/fcop-standalone-zh.md` 按 v2 身份重写（无 schema 依赖，可随时启动）
- ⏳ §8.6 backlog #5: `codeflow-plugin/` 剩余资产搬到 `.codeflow/` 标准目录（无 schema 依赖，可随时启动）

## 给 ADMIN 的建议（不是决策门槛，可一句话回复）

1. **是否打开 Issue #2 自己看一眼**？如果你看了发现什么想改 / 想加 maintainer 提及（@提某人）/ 想加 label，PM 立刻执行
2. **接下来主推哪个**？Sprint S3 (codeflow-runtime 实现) / §8.6 backlog #4 (overview 重写) / §8.6 backlog #5 (codeflow-plugin 资产迁移)
3. **是否要给 FCoP Issue #2 加 GitHub label**（比如 `proposal` / `discussion` / `runtime`）？需要 ADMIN 在 FCoP 仓 settings 里先建好 label，PM 才能用 `gh issue edit` 加

PM-01 待命。
