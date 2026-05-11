---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-011
sender: PM
recipient: ADMIN
priority: P0
thread_key: pre-s3-housekeeping
references:
  - REPORT-20260509-010-PM-to-ADMIN
  - TASK-20260509-007-PM-to-DEV
  - REPORT-20260509-007-DEV-to-PM
---

# Sprint S3 启动前 housekeeping — 全部完成 ✅

## ADMIN 5/9 11:29 「按推荐做」决策已 100% 兑现

| 决策点 | 选择 | 兑现 |
|---|---|---|
| **D1** fcop 环境 | A1 | ✅ |
| **D2** 角色配置 | B1 | ✅ |
| **D3** tasks 归档 | C1 | ✅ |
| **D4** 节奏 | (a) 一起做 | ✅（约 35 分钟，预算 60）|
| **D5** 先 commit | (yes) | ✅（commit 1 = `6595427`，commit 2 = `04b3cdf`，独立两条）|

## git history 结构（你看 git log --oneline）

```
04b3cdf chore(s3-prep): pre-Sprint-S3 housekeeping — fcop guide + roles map + tasks archive
6595427 feat(v2): launch CodeFlow AI Runtime — design, schemas, charter, hard rule #5 purge
2ae9da2 chore: fcop 0.6.1, add fcop-mcp 0.6.1 source and PyPI release           ← 历史
```

两条新 commit 各自独立，语义清晰：
- `6595427` = "v1 → v2 身份反转" 大事件（包含设计文档 + 协议包 + 硬规则 #5 删除 + 宪法块嵌入 + Issue #2 推送 + 5/9 全部 task 链路）—— 151 files / +9867 / -13944
- `04b3cdf` = "Sprint S3 启动前 housekeeping" 小事件（A1+B1+C1）—— 39 files / +512 / 0 destructive，全是 rename + new + minor edits

## 三件交付物详情

### A1 — fcop 环境锁定 ✅

**改动**：`docs/integrations/fcop-standalone-zh.md` 末尾追加 1 节「本仓 contributor 如何在自己机器上接 fcop-mcp」（约 60 行）

**核心**：
- 一句话说明本仓不再 ship fcop 安装素材（链到硬规则 #5）
- 推荐路径：上游 README → PyPI 安装 → `~/.cursor/mcp.json` 用户级配置 → 重启 → 验证
- 故障排查表 + 设计理由 + IDE 外验证方式
- 标注「v0.2 sprint 全文重写」(§8.6 backlog #4)

**合规性**：grep `pip install fcop-mcp` = 1 处，是 *指向上游* 的措辞（"一般是…请以上游 README 为准"），不是步骤教程。✅ 不违反硬规则 #5。

### B1 — 角色配置归集 ✅

**改动**：`docs/agents/CURRENT-ROLES.md` 新建（236 行）

**核心**：
- 顶部宪法引用块
- dev-team 5 角色三源对照表（`.cursor/rules/` × `docs/agents/{ROLE}-01.md` × `codeflow-plugin/agents/dev-team/`）
- 三源关系图（ASCII） + 冲突时谁赢规则（`.cursor/rules/` 永远赢）
- 协议元数据头模板
- 未来演进路径（链向 §3.2 + §8.6 backlog #5）
- 本文件的"不做"清单（不创建 roles.yaml/.codeflow/，不引入 Agent.layer）

**核心节制**：B1 没创建任何 v2 新格式（`roles.yaml` / `.codeflow/`），等 FCoP Issue #2 闭环 + Sprint S3 启动后再做。

### C1 — tasks/ 历史归档 ✅

**改动**：
1. `docs/agents/tasks/_archive/2026-04/` 新建
2. **33 个文件** `git mv` 到归档目录（git 100% similarity 识别 = 完美 rename）
3. `docs/agents/tasks/TASK-20260509-005-PM-to-DEV.md` 加 SUPERSEDED 旗（frontmatter `status:` + `superseded_by:` + `superseded_at:` + 顶部警告引用块）
4. `docs/agents/tasks/_archive/README.md` 新建（约 70 行：归档原则 4 条 + 结构 + 引用稳定性 + SOP + 不归档判定 + 当前归档状态）

**结果**：`docs/agents/tasks/` root 从 **54 → 15** 文件（README + 12 个 5/9 active + TASK-007 + 本 REPORT），肉眼一目了然。

## tasks/ root 现状（清爽，5 active thread）

```
docs/agents/tasks/
├── README.md
├── _archive/
│   ├── README.md
│   └── 2026-04/  (33 files)
├── REPORT-2026 0509-001 ~ 011  (各活跃 thread 的 PM/DEV 报告，11 个)
├── TASK-2026 0509-002 ~ 007    (PM/ADMIN 派单，5 个 + TASK-005 superseded)
└── (5 active thread: sdk-spike / runtime-skeleton / fcop-issue-decision / rule5-purge / pre-s3-housekeeping)
```

## 全部 10 项验收逐项实测

| # | 验收项 | 实测 | 通过 |
|---|---|---|---|
| 1 | A1 不破坏硬规则 #5 | grep 仅含"指向上游"措辞 | ✅ |
| 2 | B1 文档完整 + 不创 roles.yaml/.codeflow/ | 3 项核查全对 | ✅ |
| 3 | C1 ≥ 29 文件归档 | 33 个 | ✅ |
| 4 | C1 tasks/ root ≤ ~17 | 15 | ✅ |
| 5 | C1 TASK-005 SUPERSEDED 旗 | 4 处 grep 命中 | ✅ |
| 6 | C1 _archive/README.md 存在 | True | ✅ |
| 7 | ReadLints 0 错误 | 0 | ✅ |
| 8 | .cursor/rules/ 未动 | git diff = 0 | ✅ |
| 9 | codeflow-plugin/agents/ 未动 | git diff = 0 | ✅ |
| 10 | _ignore/audit_fcop_* 未动 | Test-Path = True | ✅ |

## 影响 ADMIN 的部分

| 维度 | 影响 |
|---|---|
| 你打开 `docs/agents/tasks/` | 从一坨 54 文件变成 15 文件 + 1 个 `_archive/` 子目录 ✅ |
| 你打开 `docs/agents/CURRENT-ROLES.md` | 一张表看清当前 5 角色的 3 源关系 ✅ |
| 你打开 GitHub 仓页面（5/9 之后任何时候）| 看到 2 条干净的新 commit `feat(v2)` + `chore(s3-prep)` ✅ |
| 你 Cursor 现有 agent 会话 | 0 影响 — 没动任何 `.cursor/rules/` ✅ |
| 你打开历史归档文件（如 `_archive/2026-04/TASK-20260420-*.md`）| 内容完全没变（git rename 100% similarity）✅ |
| `D:\FCoP` 上游仓 | 0 影响 ✅ |
| FCoP Issue #2 | 不变（仍 OPEN，等回应）✅ |

## §8.6 backlog 进展更新

| # | 项 | 优先级 | 状态 |
|---|---|---|---|
| 1 | §8.0 加硬规则 #5 + §0.0 嵌入宪法块 | P0 | ✅ 完成（早晨） |
| 2 | §8.2 表 + §8.5 时间表更新事实 | P0 | ✅ 完成（早晨） |
| 3 | 新增 §8.6 LEGACY 退役账本 | P0 | ✅ 完成（早晨） |
| 4 | `docs/integrations/fcop-standalone-zh.md` 按 v2 身份重写 | P1 → 现降为 P2 | 🟡 部分完成（A1 加了一节贡献者指引；全文重写留 v0.2）|
| 5 | `codeflow-plugin/` 剩余资产搬到 `.codeflow/` | P2 | ⏸ 待 FCoP Issue #2 + Sprint S3 |
| 6 | `_ignore/audit_fcop_*` 是否清理 | P2 | ⏸ 留作下次 housekeeping |
| 7 | `CHANGELOG.md` 添加 5/9 退役条目 | P2 | ⏸ 下次发版前 |
| 8 | `docs/release-process.md` 更新跨仓发版流程 | P3 | ⏸ v0.2 mobile sprint 前 |
| 9 | README.md/.en/.zh 顶部嵌入精简版宪法块 | P1 | ✅ 完成（早晨）|
| 10 | overview.md/.en 顶部嵌入精简版宪法块 | P1 | ✅ 完成（早晨）|

新增 backlog 项（来自 DEV-007 报告建议）：
- 新 #11: 写脚本自动生成 CURRENT-ROLES.md（避免手工 drift）— P3，留作 Sprint S3 之后

## 现在是 Sprint S3 的准备完毕状态

✅ 项目身份清晰（宪法 2 句锁住 + 设计文档 §0.0 + 5 文件嵌入）
✅ 角色配置清晰（CURRENT-ROLES.md 一张表 + 3 源关系图）
✅ fcop 环境清晰（contributor 接入指引就位 + 0 个本仓 fcop 定义内容）
✅ tasks 历史清爽（root 15 文件 + _archive/2026-04/ 33 文件）
✅ 上游协调进行中（FCoP Issue #2 OPEN，等回应）
✅ git history 干净（2 条新 commit 各自独立 + 语义清晰）
✅ `_ignore/` 不再入 git（`.gitignore` 已修复）

**Sprint S3 任何时候启动都没有遗留状态阻挡。**

## PM 等你 3 件事

1. **是否 push 到 GitHub remote**？
   - 当前 2 条新 commit 还在本地，没 push
   - PM 默认建议：`git push origin main`（按 Cursor agent rule，不需要再问；但因这是首次 push 大量 v2 内容到公网，PM 节制起见还是问一下）

2. **Sprint S3 立刻启动 vs 等 FCoP Issue #2 maintainer 反馈**？
   - 立刻启动 = 在不动 §3 schema 的前提下做 codeflow-runtime 的更多骨架
   - 等反馈 = 全队进入"待命 + 监听"状态

3. **是否 close 当前 PM-01 chat 会话，新开一个 Sprint S3 专用 chat**？
   - 当前会话已积累大量上下文（v2 启动整个过程都在里面），可能影响后续 sprint 的清晰度
   - PM 默认建议：close 当前 + 新开 Sprint S3 专用，链接到本 REPORT-011 作为起点

---

**今天 5/8 晚 → 5/9 上午这一轮完结**：从 ADMIN 一句"FCoP MCP 配置漂移要修"开始，到现在 v2 真正变成一个自洽、有宪法、有协议提案在上游、有干净 git history 的项目。

PM-01 待命。
