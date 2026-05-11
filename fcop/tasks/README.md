# docs/agents/tasks/

本目录是 CodeFlow 项目**自身**的 FCoP 任务流水。和其它项目里的 `tasks/` 一样，
遵循 `TASK-YYYYMMDD-序号-发送方-to-接收方.md` 命名。

## 特殊文件：20260420 批次（不要合并 / 不要删）

本目录里有一批 `TASK-20260420-001-*.md` 文件，看上去像"一批普通任务"，其实是
**FCoP 协议自然涌现的证据**，请保持原样保留。

| 文件 | 角色 | 关键点 |
|---|---|---|
| `TASK-20260420-001-ADMIN-to-PM.md` | ADMIN → PM | 一条"帮我生成视频"的需求 |
| `TASK-20260420-001-PM-to-ADMIN.md` | PM → ADMIN | 接单回执 |
| `TASK-20260420-001-PM-to-DEV.md`   | PM → DEV   | 技术派工 |
| `TASK-20260420-001-DEV-to-PM.md`   | DEV → PM   | 完成回执（方案升级到 Banana） |

### 为什么要保留

这 4 份文件**不是人类按 FCoP 协议主动写的**，而是 2026-04-20 凌晨，一个 Cursor agent
在执行**完全无关**的视频生成任务（`D:\CloudMusic` 目录）时，**自发**把自己拆成
ADMIN / PM / DEV 多个角色并产出了这 4 份内部公文。当我们问它"为什么要这样做"时，
它给出了一条**我们从未写过**的总则：

> _"AI 角色之间不能只在脑子里说话，必须落成文件。"_

我们随后把这条总则反向收编进了 `.cursor/rules/codeflow-project.mdc` 的"核心原则"章节。

因此：

- **不要合并或重写这 4 份文件**——它们是"规则被 agent 自发升华"这一现象的原始证据
- **不要挪走它们的位置**——它们放在 `docs/agents/tasks/` 下正是因为 agent 认为"这是 FCoP 项目的 tasks 目录，公文应该落在这里"
- **不要给它们加新的条目或修改 frontmatter**——保持原始快照

### 完整证据档案与事件记录

- 原始 4 份公文的同步副本在 `D:\CloudMusic\tasks\`（事件发生地）
- 完整 essay 与证据档案：
  [FCoP 公仓 · essays/fcop-natural-protocol.md](https://github.com/joinwell52-AI/FCoP/blob/main/essays/fcop-natural-protocol.md)
- 触发视频生成的脚本：`scripts/gen_song_video.py`

---

## 其它文件（日常 FCoP 流水）

本目录下其它 `TASK-*.md` 是 CodeFlow 项目自身的 ADMIN / PM / DEV / OPS / QA 之间的
日常任务流转，遵循 `.cursor/rules/` 下各角色的规则约束，随时间正常追加。
