---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-012
sender: PM
recipient: ADMIN
priority: P0
thread_key: r2-three-remote-backup
references:
  - REPORT-20260509-011-PM-to-ADMIN
  - TASK-20260509-008-PM-to-OPS
  - REPORT-20260509-008-OPS-to-PM
---

# R2 纯备份完成 — 2/3 仓同步；gitee 发现历史分叉，等你拍板

## TL;DR

✅ **origin + backup 两仓已同步到最新**（`04b3cdf`）— 今天的 v2 工作已经在 GitHub 主仓和备份仓里，**PC 故障也丢不了**。
⚠️ **gitee 没推** — OPS 检测到 gitee 上有 3 个独立 commit（v2.12.0 时代遗留），不在新 main history 上；按 git safety 协议不擅自 force-push，需要你拍板 G1/G2/G3 三选一。

## 三仓现状

```
local        : 04b3cdf  ━━━━━━━━━━━━━┓
origin/main  : 04b3cdf  ━━ ✅ 同步 ━━┫
backup/main  : 04b3cdf  ━━ ✅ 同步 ━━┛
gitee/main   : 62532a7  ━━ ⚠️ 分叉 (停在 v2.12.0 时代)
```

origin / backup 上都能看到完整 3 commit history：

```
04b3cdf  chore(s3-prep): pre-Sprint-S3 housekeeping
6595427  feat(v2): launch CodeFlow AI Runtime
2ae9da2  chore: fcop 0.6.1, add fcop-mcp 0.6.1 source
```

## 为什么 gitee 不能直接推

OPS 用 `git merge-base --is-ancestor` 诊断三仓与 local 的关系：

| Remote | 是 local 祖先？| 安全 push？|
|---|---|---|
| origin/main | ✅ YES | fast-forward ✅ |
| backup/main | ✅ YES | fast-forward ✅ |
| **gitee/main** | ❌ **NO** — 真实分叉 | **不安全**，只能 rebase 或 force-push |

gitee 上的 3 个独立 commit（不在 origin/local history）：

```
62532a7  release: CodeFlow Desktop v2.12.0
b3874ab  fix-cdp-fullmd-nudger-leader
04e1f2e  fix-nudger-status-fallback
```

历史推断：v2.12.0 release 周期时，desktop 团队曾把 release commit + 2 个 nudger fix 直接 push 到 gitee，但**没回流到 origin**——origin 后来走了 v2.12.1 ~ v2.12.17 的不同路径。这是一次"中国式镜像偏离"，不是今天的事，是历史遗留。

## 影响 ADMIN 的部分（重要）

| 维度 | 影响 |
|---|---|
| 你今天的 v2 工作丢失风险 | ✅ **彻底消失** — 已在 GitHub 主仓 + 备份仓两个独立账号下持有完整 history |
| 你打开 [github.com/joinwell52-AI/codeflow-pwa](https://github.com/joinwell52-AI/codeflow-pwa) | ✅ 立刻能看到今天的 2 commit + 完整 v2 内容（README / overview / design / packages 等）|
| 你打开 [github.com/joinwell52-AI/codehouse](https://github.com/joinwell52-AI/codehouse) (备份仓) | ✅ 同样能看到 |
| 你打开 [gitee.com/joinwell52/cursor-ai](https://gitee.com/joinwell52/cursor-ai) | ⚠️ 仍是 v2.12.0 时代的样子，无 v2 启动内容 |
| 国内用户 / 国内审查 | ⚠️ 如果有人指望 gitee 看新内容，会失望 |
| Cursor Desktop EXE 自动更新 / 用户下载 | ✅ 0 影响 — 没创建 v2.13.0 tag，没创建任何 Release |
| 现有 v2.12.17 用户 | ✅ 0 影响 — 仍能正常用 |

## gitee 分叉 3 选项（请你一句话决策）

| 选项 | 做什么 | 风险/代价 | OPS 推荐度 |
|---|---|---|---|
| **G1** force-push 覆盖 gitee | `git push gitee main --force` 直接覆写 | ⚠️ 不可逆。丢 gitee 上 3 个独立 commit（v2.12.0 时代遗留）；如有人 fork 过 gitee history 会 rewrite | ⭐ |
| **G2** rebase + force-push 三仓 | 把 gitee 的 3 个 commit rebase 到 local 顶部，然后 force-push origin/gitee/backup 让 3 仓一致 | ⚠️ 把陈旧 v2.12.0 release commit 提到新 main 顶部，污染 history；要 force-push origin（生产仓！）| ⭐ |
| **G3** 暂不动 | gitee 长期作为"v1 时代镜像"凝固在 v2.12.0；下次真实发版时再决策 | ✅ 0 风险 0 数据损失；唯一缺点 = 国内镜像不更新 | **⭐⭐⭐** |

**PM 跟 OPS 一致推荐 G3** — 当前没有真实"国内用户依赖 gitee 看 v2"的需求，origin + backup 已是完整备份。等 v0.1 真正发版（约 6 周后）时再处理 gitee 问题（那时如果真要发版到国内，再走 G1 或 G2，那时 gitee 上的"丢失代价"也已被时间稀释）。

## 现在 git history 整体面貌

```
04b3cdf  ┃ chore(s3-prep): pre-Sprint-S3 housekeeping (今早)         ━━ origin ✅ + backup ✅
6595427  ┃ feat(v2): launch CodeFlow AI Runtime (今早)               ━━ origin ✅ + backup ✅
2ae9da2  ┃ chore: fcop 0.6.1 (历史)                                  ━━ origin ✅ + backup ✅
...      ┃ ... 历史 commits ...
e651139  ┃ fcop 0.5.4: ... (4 月份)                                   ━━ backup 之前停在这里
...      ┃ ... 更早历史 ...
62532a7  ┃ release: CodeFlow Desktop v2.12.0                          ━━ gitee 分叉点
```

## §8.6 backlog 进展更新

| # | 项 | 状态 |
|---|---|---|
| 12 (新增) | gitee 分叉决策（G1/G2/G3）| ⏸️ 等 ADMIN 拍板 |

## 你需要拍 1 件事

**gitee 分叉怎么办**？一句话即可：
- 「**G3，先观察**」→ PM 把它挂 §8.6 backlog #12，本轮收工
- 「**G1，强推**」→ PM 派 OPS-to 立刻 force-push gitee（不可逆，需要你 *显式* 同意 force-push）
- 「**G2，rebase 三仓**」→ PM 派 OPS-to 做 rebase，然后 force-push origin + gitee + backup（不可逆，最复杂）

## 不需要拍但可看的事

- ✅ 你打开 https://github.com/joinwell52-AI/codeflow-pwa 验证 v2 内容已可见
- ✅ 你打开 https://github.com/joinwell52-AI/codehouse 验证 backup 已同步
- ✅ FCoP Issue #2 仍 OPEN: https://github.com/joinwell52-AI/FCoP/issues/2

## 文件清单（本轮新增）

- `docs/agents/tasks/TASK-20260509-008-PM-to-OPS.md`
- `docs/agents/tasks/REPORT-20260509-008-OPS-to-PM.md`
- `docs/agents/tasks/REPORT-20260509-012-PM-to-ADMIN.md`（本文件）

⚠️ **注意**：本文件本身（REPORT-012）+ TASK-008 + REPORT-008（OPS）这 3 个文件**没在 origin/backup 上**，因为它们是 push 之后写的。要么留作下次 commit + push 一起补上，要么本轮再走一次"小 push"。PM 默认建议：留到下次 commit（本轮收工不再追加 commit）。

PM-01 待命。
