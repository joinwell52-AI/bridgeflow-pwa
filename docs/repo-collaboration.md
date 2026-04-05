# 仓库协作与整洁约定

多人改同一仓库时，按下面约定可减少分叉、冲突和杂文件。

## 分支

| 分支 | 用途 |
|------|------|
| **`master`** | **日常开发与推送的主分支**（本地默认用这名）。 |
| **`main`** | 与 **`master` 指向同一套最新提交**；若 GitHub 默认分支是 `main`，Pages/展示以它为准。 |

**推送习惯：**

- 开发完成：`git push origin master`
- 若需让 **`main`** 与 **`master` 立刻一致**（两分支已对齐、无分叉时）：

  ```bash
  git push origin master:main
  ```

- 若 **`main` 与 `master` 已分叉**，不要用强推，除非团队确认以某一侧为唯一真相；此前曾用「`main` 重置为 `master`」对齐，**会覆盖 `main` 上独有提交**，需事先共识。

## 不要提交的内容

- **`_pages_tmp/`**：本地静态快照，**勿提交**；以 `web/pwa/`、`docs/`、根目录同步副本为准。
- **桌面端调试图**：`*_crop.png`、`test_*.png`、`cursor_screenshot.png`、`cursor_vision_report.json`、`_test_layout.py` 等（已列入 `.gitignore`）。
- **凭据**：`.git-credentials`、Token、内网账号密码；勿写进仓库文件。
- **`dist/`、`build/`**：构建产物（已忽略）。

## 命名（历史兼容）

- **产品名**：**码流（CodeFlow）**。
- **目录名**：`bridgeflow-nudger/`、`bridgeflow.json` 等为历史遗留文件名；新配置优先 **`codeflow.json`**、**`codeflow-nudger.json`**（见配置参考）。

## 冲突多时以谁为准

- **约定**：以 **`master` 上已合并、已测试的最新提交**为准；需要把 `main` 对齐时，团队确认后再操作（合并或重置）。

## 相关文档

- [github-repo-about.md](github-repo-about.md) — GitHub 网页 About / Topics
- 根目录 [README.md](../README.md)、[CHANGELOG.md](../CHANGELOG.md)
