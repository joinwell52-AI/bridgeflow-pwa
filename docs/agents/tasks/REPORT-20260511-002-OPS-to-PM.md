---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260511-002
sender: OPS
recipient: PM
priority: P2
thread_key: codeflow-repo-root-gitignore-smoke-and-stale-scratch-cleanup
references:
  - TASK-20260511-002-PM-to-OPS
  - REPORT-20260510-014-OPS-to-PM
  - REPORT-20260510-014-QA-to-PM
layer: worker
---

# REPORT-20260511-002：repo 根 `.gitignore` 加 `.smoke-*/` + stale scratch 清理回执

## 一句话结论

已完成 repo 根 `.gitignore` hygiene commit：新增 `.smoke-*/` 目录忽略规则，commit `094a0b2` 已推送到 `origin/main` 与 `backup/main`。7 个 QA-014 scratch 目录中 6 个已删除；`.smoke-qa014-20260511-080830/` 因 `shell.err` 被进程占用，两次删除失败，OPS 未强杀进程，已由新 `.gitignore` 规则从常规 `git status` 中隐藏。

## 一、删除前 7 dirs 安全核验

删除前对 7 个目录逐一执行 `git ls-files --error-unmatch -- <dir>`，结果均为未跟踪：

```text
UNTRACKED .smoke-qa014-20260511-080830
UNTRACKED .smoke-qa014-claude
UNTRACKED .smoke-qa014-cs45
UNTRACKED .smoke-qa014-default
UNTRACKED .smoke-qa014-claude 
UNTRACKED .smoke-qa014-cs45 
UNTRACKED .smoke-qa014-default 
```

结论：这些 scratch 目录均非 tracked 文件，清理不会删除 git 受控内容。

## 二、删除命令执行结果

按 PM 指令清理 7 个目录；为支持尾随空格目录，OPS 使用 `-LiteralPath` + Windows extended path：

```text
DELETE_ATTEMPT_1 [.smoke-qa014-20260511-080830]
DELETE_FAILED [.smoke-qa014-20260511-080830] attempt=1 error=shell.err is being used by another process
DELETE_ATTEMPT_2 [.smoke-qa014-20260511-080830]
DELETE_FAILED [.smoke-qa014-20260511-080830] attempt=2 error=shell.err is being used by another process

DELETE_ATTEMPT_1 [.smoke-qa014-claude]
DELETED [.smoke-qa014-claude] attempt=1
DELETE_ATTEMPT_1 [.smoke-qa014-cs45]
DELETED [.smoke-qa014-cs45] attempt=1
DELETE_ATTEMPT_1 [.smoke-qa014-default]
DELETED [.smoke-qa014-default] attempt=1

DELETE_ATTEMPT_1 [.smoke-qa014-claude ]
DELETED [.smoke-qa014-claude ] attempt=1
DELETE_ATTEMPT_1 [.smoke-qa014-cs45 ]
DELETED [.smoke-qa014-cs45 ] attempt=1
DELETE_ATTEMPT_1 [.smoke-qa014-default ]
DELETED [.smoke-qa014-default ] attempt=1
```

剩余目录：

```text
.smoke-qa014-20260511-080830/
```

说明：该目录第一次和 30 秒后第二次删除均因 `shell.err` 被占用失败。OPS 未强杀进程，按 TASK §3.2 要求将占用情况写入本 REPORT，等待 PM 决定后续。

## 三、`.gitignore` diff 摘要

根 `.gitignore` 在运行时段后新增 6 行：

```diff
+# ── Smoke / dev-test scratch dirs at repo root (PM TASK-20260511-002) ──
+# DEV / QA self-tests sometimes drop .smoke-* scratch directories at
+# the repo root (e.g. .smoke-qa014-20260511-080830/). codeflow-shell
+# subtree already excludes them; this line covers the repo root.
+.smoke-*/
```

编辑过程说明：根 `.gitignore` 含中文注释，OPS 使用 Python UTF-8 写入，并在发现初次写入导致全文件换行 diff 后立即恢复 CRLF，最终 staged diff 只保留上述新增块。

## 四、Safety HARD GATE

### 4.1 删除前 tracked 核验

```text
7/7 UNTRACKED
0 tracked smoke dirs
```

### 4.2 `.gitignore` diff 范围

```text
git diff -- .gitignore
仅新增 .smoke-*/ 规则块
```

### 4.3 staged 文件核验

```text
git diff --cached --name-only
.gitignore

cached file count: 1
```

### 4.4 不携带 OPS 范围外文件

提交前 staged 区仅 `.gitignore` 一个文件，未携带：

```text
docs/agents/tasks/REPORT-20260510-014-OPS-to-PM.md
docs/agents/tasks/REPORT-20260510-014-QA-to-PM.md
docs/agents/tasks/REPORT-20260511-001-PM-to-ADMIN.md
docs/agents/tasks/TASK-20260510-014-PM-to-OPS.md
docs/agents/tasks/TASK-20260510-014-PM-to-QA.md
docs/agents/tasks/TASK-20260511-001-PM-to-DEV.md
docs/agents/tasks/TASK-20260511-002-PM-to-OPS.md
packages/codeflow-runtime/src/registry/AgentSdkAdapter.ts
```

其中 `packages/codeflow-runtime/src/registry/AgentSdkAdapter.ts` 是 DEV-001 代码线的工作区修改，OPS 本轮未 stage、未提交。

## 五、Commit 与推送

### commit

```text
094a0b2 chore(repo-hygiene): add .smoke-*/ to root .gitignore and clean stale QA-014 scratch
1 file changed, 6 insertions(+)
```

### push

```text
origin main: 70422ba..094a0b2
backup main: 70422ba..094a0b2
```

GitHub push 仍提示 `joinwell52-AI/codeflow-pwa` default branch 有 12 个 Dependabot vulnerabilities（8 high, 3 moderate, 1 low）。本任务不处理该事项，保持 PM 后续单独排期。

## 六、远端核对

```text
local : 094a0b2f7663de0c5832c8cc9277f896d416dc4a
origin: 094a0b2f7663de0c5832c8cc9277f896d416dc4a
origin MATCH

backup: 094a0b2f7663de0c5832c8cc9277f896d416dc4a
backup MATCH

gitee : 62532a7d32779bbd0ec09c7e0fbcb6cc6541b4fe refs/heads/main
```

结论：`origin/main` 与 `backup/main` 已同步到本地 HEAD；`gitee` 仍保持 G3 隔离；未创建 tag、未推送 tag。

## 七、post-commit `git status --short`

```text
 M packages/codeflow-runtime/src/registry/AgentSdkAdapter.ts
?? docs/agents/tasks/REPORT-20260510-014-OPS-to-PM.md
?? docs/agents/tasks/REPORT-20260510-014-QA-to-PM.md
?? docs/agents/tasks/REPORT-20260511-001-PM-to-ADMIN.md
?? docs/agents/tasks/TASK-20260510-014-PM-to-OPS.md
?? docs/agents/tasks/TASK-20260510-014-PM-to-QA.md
?? docs/agents/tasks/TASK-20260511-001-PM-to-DEV.md
?? docs/agents/tasks/TASK-20260511-002-PM-to-OPS.md
```

补充核验：

```text
git status --short --ignored | Select-String '^!! \.smoke-qa014'
!! .smoke-qa014-20260511-080830/
```

说明：常规 `git status --short` 已不再被 smoke 目录污染；剩余 locked scratch 目录仅在 ignored 视图中出现。

## 八、结论与后续建议

OPS-002 完成。建议 PM 后续：

1. 若 `.smoke-qa014-20260511-080830/` 长时间仍被占用，确认是否有 QA smoke 进程未退出，再决定是否授权终止。
2. 等 DEV-001 完工后另派 OPS 任务处理 `v0.2.0-beta.3` commit/tag，不要把本 REPORT 与 DEV 代码线混入同一提交。
