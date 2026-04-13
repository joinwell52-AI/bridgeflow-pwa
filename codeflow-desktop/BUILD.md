# 打包码流（CodeFlow）Desktop（.exe）

与 **`CHANGELOG.md`** 中桌面端版本一致；当前 **`web_panel.py`** 中 **`_VERSION`** 与发布说明、面板右上角 **PC v…** 同步（例如 **2.2.0**）。

## 环境

- Windows 10/11，**Python 3.12**（你当前环境；亦兼容 3.10+）
- 建议虚拟环境，避免污染全局

## 依赖

```powershell
cd D:\\CodeFlow\\codeflow-desktop
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -U pip
pip install -r requirements.txt
pip install pyinstaller winocr
```

说明：**winocr** 用于 `cursor_vision` OCR；若只做无视觉盲操作，可不装 winocr，但需在 `build.spec` 里去掉对应 `hiddenimports`（不推荐）。

## 团队模板：初始化后不可在面板内「切换」

- 团队种类（软件开发 / 自媒体 / MVP）在 **首次向导** 中写入项目下 **`docs/agents/codeflow.json`**。
- **已配置完成后，面板不提供「切换团队」按钮**。若要改用另一套模板，请使用面板顶部 **「重置」**（清除本机码流配置）后 **重新走向导** 选择项目与模板；详见面板「团队」区块说明与重置确认框。
- **「同步角色模板」**：仅按 **当前** `codeflow.json` 已选团队，把内置 `templates/agents/<team>/` 拷贝到项目的 `docs/agents/`（并清理根目录旧 `*.md`），**不会**单独把模板从 A 换成 B。

## 角色模板（多套团队）与主仓一致

内置三套：`templates/agents/dev-team/`、`media-team/`、`mvp-team/`。  
「同步角色模板」时：**先删除** `docs/agents/` **根目录下**旧有 `*.md`（不删 `tasks/` 等子目录与 `codeflow.json`），再拷贝当前团队目录下文件，避免换团队后开发组与自媒体角色文档混叠。  

dev-team 示例文件名：`PM-01.md`、`DEV-01.md`、`QA-01.md`、`OPS-01.md`、`ADMIN-01.md`（及 `.en.md`）。自媒体为 `PUBLISHER.md` 等，与面板「团队」一致。  

发布前请从仓库 **`docs/agents/`** 同步到 **`codeflow-desktop/templates/agents/dev-team/`**（本仓库已对齐；若只改主仓文档，请再执行一次复制以免 EXE 内仍是旧版）。

## 可选资源（面板）

`build.spec` 会按需打包 `panel/` 下存在的文件。若有图标与 Logo，可放入：

- `panel/app.ico` — 可执行文件图标  
- `panel/logo-sm.png`、`panel/logo.png` — 面板页眉图片  

没有这些文件时仍可成功打包，仅面板图片可能不显示。

## 图标（exe 角标，强制）

**没有 `panel\app.ico`（或文件非法）时，`pack.cmd` 会直接失败，不会生成无自定义图标的 exe。**

## 图标（exe 角标）

与 PyInstaller 文档一致：**放一个 `panel\app.ico`，打包时带上 `--icon`** 即可。

- **`-i`** 与 **`--icon`** 等价，例如 **`-i panel\app.ico`**。
- **注意**：若入口是 **`build.spec`**，PyInstaller **不允许**再写 `-i/--icon`（会报 `makespec options not valid`）。图标只能写在 spec 的 `EXE(..., icon=...)` 里。
- **`pack.cmd`** 已改为对 **`main.py` 走完整命令行**，并带 **`-i panel\app.ico`**（与上面等价）。首次运行会在同目录生成 **`CodeFlow-Desktop.spec`**（自动生成，可与手写的 **`build.spec`** 并存；日常以 **`pack.cmd`** 为准即可）。

## 执行打包

**方式 0（最简单）：双击或运行**

```text
pack.cmd
```

（内部为：`taskkill` 杀旧进程 → `rmdir build dist` → `py -3.12 -m PyInstaller build.spec --noconfirm --clean`）

> ⚠️ **注意**：Windows Defender 实时保护会扫描并短暂锁住生成的 EXE，导致第二次打包时 `rmdir dist` 失败。
> 解决方法：打包前手动删掉 `dist\` 目录，或将 `dist\` 和 `build\` 加入 Defender 排除列表：
> ```powershell
> Add-MpPreference -ExclusionPath "D:\BridgeFlow\codeflow-desktop\dist"
> Add-MpPreference -ExclusionPath "D:\BridgeFlow\codeflow-desktop\build"
> ```

**方式 B（命令行，用系统 Python 3.12）：**

```powershell
cd D:\BridgeFlow\codeflow-desktop
py -3.12 -m PyInstaller build.spec --noconfirm --clean
```

成功后：

- 输出：`dist\CodeFlow-Desktop.exe`（单文件，约 35 MB，无控制台窗口）

---

## 发版流程

### 前提条件（首次配置，之后永久有效）

#### GitHub（gh CLI）
```powershell
winget install --id GitHub.cli --accept-source-agreements --accept-package-agreements
gh auth login --web   # 按提示浏览器授权，只需一次
```

#### Gitee（国内镜像）
1. 登录 [gitee.com/profile/personal_access_tokens](https://gitee.com/profile/personal_access_tokens)，生成 Personal Access Token（需勾选 `projects` 权限）
2. 把 token 写入本地文件（**不提交 Git**）：
   ```powershell
   "你的token" | Out-File -Encoding ascii D:\BridgeFlow\codeflow-desktop\.gitee_token
   ```

#### 代码远端
```powershell
# 首次配置（已配好可跳过）
git remote add gitee https://joinwell52:<gitee_token>@gitee.com/joinwell52/cursor-ai.git
```

---

### 每次发版步骤

**第一步：升版本号**

修改 `main.py` 和 `web_panel.py` 中的版本号（保持一致）：
```python
VERSION = "2.9.xx"   # main.py
_VERSION = "2.9.xx"  # web_panel.py
```

**第二步：写发版说明**

在项目根 `CHANGELOG.md` 顶部（`[Unreleased]` 下方）新增版本块：
```markdown
## [2.9.xx] - YYYY-MM-DD
### 桌面端（codeflow-desktop）
#### 改进/修复：xxx
- 说明1
- 说明2
```

**第三步：提交 + 打包**

```powershell
cd D:\BridgeFlow

# 提交代码
git add -A
git -c "trailer.ifExists=doNothing" commit -m "feat/fix: 说明 (v2.9.xx)"
git push origin main
git push backup main
git push gitee main

# 打 tag
git tag v2.9.xx
git push origin v2.9.xx
git push gitee v2.9.xx

# 打包（清理旧产物后用 build.spec）
cd codeflow-desktop
Remove-Item -Recurse -Force dist, build -ErrorAction SilentlyContinue
py -3.10 -m PyInstaller build.spec --noconfirm
```

> 成功后：`dist\CodeFlow-Desktop.exe`（约 35 MB）

**第四步：发布到 Gitee（国内，秒完）**

```powershell
cd D:\BridgeFlow\codeflow-desktop
py -3.10 _gitee_pub.py
```

**第五步：发布到 GitHub（后台上传，较慢）**

```powershell
py -3.10 _github_pub.py
```

> GitHub 上传因国内网络较慢（1～5 分钟），可后台跑，不影响用户（用户优先走 Gitee 下载）。

---

### 发版脚本说明

| 文件 | 用途 |
|------|------|
| `_gitee_pub.py` | 发布到 Gitee Releases（读 `.gitee_token`，读 `CHANGELOG.md` 作说明） |
| `_github_pub.py` | 发布到 GitHub Releases（读 `gh auth token`，读 `CHANGELOG.md` 作说明） |
| `release.py` | 通用发版脚本（命令行参数，同时发两端）：`py -3.10 release.py 2.9.xx dist/CodeFlow-Desktop.exe` |

### 发版后地址

```
GitHub：https://github.com/joinwell52-AI/codeflow-pwa/releases/tag/vX.X.X
Gitee： https://gitee.com/joinwell52/cursor-ai/releases/tag/vX.X.X
```

---

### 自动更新机制（updater.py）

用户安装后，应用启动时自动检查新版本（以 GitHub API 为版本源），下载时：

1. **并发测速** Gitee 和 GitHub（各发一个 HEAD 请求）
2. **Gitee 响应 < GitHub + 500ms** 时走 Gitee（国内用户几乎必走 Gitee）
3. **主线路失败**自动切换备用线路，无需用户干预
4. **走系统代理**（VPN/系统代理自动生效，不会卡在 0%）

### 常见问题

| 现象 | 处理 |
|------|------|
| `rmdir dist` 失败 / PermissionError | Defender 锁住了 EXE，手动删 `dist\` 目录，或加 Defender 排除：`Add-MpPreference -ExclusionPath "D:\BridgeFlow\codeflow-desktop\dist"` |
| `gh: command not found` | 重开终端让 PATH 生效 |
| git push 被拒（含 Token 的脚本） | 检查提交是否含 `_*.py` 密钥，`git rm --cached` 后重提交 |
| GitHub Release 已存在 | 脚本会自动查询已有 ID 并直接上传附件，无需手动删除 |
| Gitee Release 已存在 | 同上，脚本自动处理 |
| EXE 体积异常（127MB+） | 必须用 `build.spec` 打包，不要用 `--hidden-import` 命令行参数 |

## 运行

### 首次运行（新项目）

将 `CodeFlow-Desktop.exe` 放到项目文件夹根目录，双击启动：

1. 程序自动以 **exe 所在目录**为项目根，无需选择文件夹。
2. 若项目下无 `docs/agents/codeflow.json`，自动打开**沉浸式引导向导**（系统浏览器）：
   - **Step 1 连接 Cursor**：自动检测 `Cursor.exe`；未找到时点"浏览选择"手动指定。
   - **Step 2 选择团队**：软件开发 / 自媒体 / MVP 三套模板。
   - **Step 3 初始化项目**：点"浏览"选择项目目录（默认已填入 exe 所在目录），点"保存并启动"。
3. 点"保存并启动"后：
   - 后端 1 秒内自动退出进程
   - 浏览器页面显示"配置已保存"，3 秒后自动关闭标签
   - **重新双击 exe** 即进入正常启动流程（嵌入 Cursor 面板）

### 正常启动（已配置项目）

双击 exe → 自动找到 Cursor 窗口 → 在 Cursor Simple Browser 内嵌入控制面板。

- `Cursor.exe` 路径保存在 **`%APPDATA%\CodeFlow\config.json`**（全局，跨项目共用）。
- 项目配置（team、room_key、relay_url 等）保存在 **`{项目目录}/.codeflow/config.json`**。
- 运行日志在 **`{项目目录}/.codeflow/desktop.log`**。

## 默认：在 Cursor 内嵌入面板（主路径，自动化）

启动后本机面板为 **`http://127.0.0.1:18765/`**。**默认**会尝试用 **pyautogui** 在已运行的 Cursor 里走 **命令面板 → Simple Browser → 填入 URL**（与手动 Ctrl+Shift+P 等价）。若无 Cursor 窗口且允许，会尝试启动 Cursor 后再试；仍失败则回退系统浏览器，并按 `auto_snap_on_launch` 尝试 Windows 左右分屏。

- **不要求 MCP**：普通用户只需 Cursor + 本桌面端；**无需**配置 Cursor `mcp.json`。MCP 可作为后续高级能力单独说明。
- **关闭嵌入**：项目根 **`codeflow-nudger.json`** 设 **`"open_panel_in_cursor": false`**，或环境变量 **`CODEFLOW_NO_EMBED=1`**。
- 可选字段：**`launch_cursor_if_absent`**（默认 `true`）、**`cursor_exe_path`**（非标准安装路径时填写 `Cursor.exe` 完整路径）。
- 嵌入使用命令面板：先 **Ctrl+Shift+P**，再粘贴 **`Simple Browser`**（剪贴板，避免键盘布局导致字符错误）。若你本机命令名不同，可在启动前设置环境变量 **`CODEFLOW_EMBED_PALETTE_TEXT`** 为命令面板里能搜到的片段。

若配置了下文 **ACP 端点**，则 **ACP 优先**；未配置 ACP 时使用上述嵌入流程。

## 可选：Cursor ACP 在编辑器内打开面板（实验性）

若你使用的 **Cursor 3.x+** 在本地提供 **JSON-RPC over HTTP** 端点，且支持社区所述的 `workspace/openSimpleBrowser`（含 `layout` / `widthRatio` 等参数），可在项目根 **`codeflow-nudger.json`** 中配置：

- **`cursor_acp_endpoint`**：完整 HTTP URL（例如 `http://127.0.0.1:…`，以你本机实际为准）。  
- 可选：**`cursor_acp_layout`**（默认 `split-right`）、**`cursor_acp_width_ratio`**（默认 `0.35`）。

启动 CodeFlow Desktop 时将 **优先** 对该地址 POST JSON-RPC；**成功则不再**调用系统默认浏览器，也 **不再** 执行 `win_snap` 贴窗。失败时自动回退为「浏览器 + 分屏脚本」。

若未配置端点，也可设置环境变量 **`CODEFLOW_ACP_ENDPOINT`**（与上同义）。

**注意**：端口号、路径、鉴权与 method 名以 **Cursor 实际版本** 为准；公开文档可能滞后，需自行用开发者工具或官方说明核对。本仓库内的请求体为示例形状，不保证与每一版 Cursor 二进制一致。

## 巡检机制：时间节奏与卡住处理

### 催办时间节奏

| 行为 | 频率 | 控制参数 |
|---|---|---|
| 主循环（扫文件） | 每 5s | `poll_interval` |
| idle「继续」检测 | 每 ~30s（6轮） | `idle_check_every_n` |
| 卡住任务扫描 | 每 ~150s（30轮） | `stuck_check_every_n` |
| 同一 TASK 最小催促间隔 | 5 分钟 | `auto_nudge_interval_s` |
| 同收件人发完后冷却 | 15s | `nudge_cooldown` |

所有参数均可在项目根 **`codeflow-nudger.json`** 中覆盖（`main.py` 启动时自动加载）。

### 卡住判定

`tasks/` 下标准任务 `.md` 自 **最后修改时间** 起超过 `task_stuck_threshold_s`（默认 600s = 10 分钟），且该 TASK 编号未在 `reports/` 或 `log/` 文件名中出现（闭环），即视为「可能卡住」。超过 `task_timeout_threshold_s`（默认 1200s = 20 分钟）升级为「超时」。

### 首次身份校验（绝不发错窗口）

每个角色 **首次** 发送的 `first_hello`（包含 `role_file` 角色定义指引）使用 **`greet_strict` 模式**：

1. 切换侧栏后等待 **12 秒**，让 Cursor UI（author / title）完全渲染
2. OCR 三重校验：侧栏 + Author 一致，或 侧栏 + Title 一致（任一组内部不一致则拒绝等待重扫）
3. 多轮复核（共 5 次 vision_scan，间隔 4s）全部通过
4. **粘贴前终检**：静止 3s 再扫一次，不通过则整条消息放弃
5. **`msg_factory` 延迟生成**：消息内容在角色确认后才生成（不预先生成），确保消息内容与当前窗口角色严格绑定
6. **失败无限重试**：校验失败后指数退避（10→20→40→60s）持续重试，直到成功，绝不放弃

### 后续催办短句

首次身份确认后，该角色的所有后续催办（新文件、定时催促、卡住通知）改为短句：

> **`【码流巡检】巡检，开工。请自行查看 docs/agents/tasks/ 等待办任务。`**

Agent 自行阅读任务文件，不再附文件名与说明。可通过 `codeflow-nudger.json` 中 `patrol_ping_zh` / `patrol_ping_en` 覆盖。

### 卡住时自动 Reload Window

当任务年龄 ≥ `stuck_reload_min_age_s`（默认 600s）且 `stuck_reload_window: true`，自动催促前先执行：

```
Ctrl+Shift+P → 粘贴「Developer: Reload Window」→ 回车
```

Reload 完成后等待 `reload_window_wait_s`（默认 12s），重新获取窗口句柄，再发短句催办。`stuck_reload_once_per_task: true`（默认）确保同一任务最多 reload 一次，避免循环刷窗口。

### codeflow-nudger.json 完整字段参考

```json
{
  "poll_interval": 5,
  "nudge_cooldown": 15,
  "idle_check_every_n": 6,
  "stuck_check_every_n": 30,
  "task_stuck_threshold_s": 600,
  "task_timeout_threshold_s": 1200,
  "auto_nudge_interval_s": 300,
  "patrol_ping_zh": "",
  "patrol_ping_en": "",
  "stuck_reload_window": true,
  "stuck_reload_min_age_s": 600,
  "stuck_reload_once_per_task": true,
  "reload_window_wait_s": 12
}
```

空字符串的 `patrol_ping_zh/en` 表示使用内置默认文案。

## 产品定位（界面分工）

- **CodeFlow 控制台**：管项目下 `docs/agents/` 任务文件、巡检、预检与轨迹。  
- **Cursor**：当作多 Agent 聊天终端（侧栏 Agent 列表 + 对话）；编辑器区域按个人习惯即可。  
- **环境预检**：面板检查项目目录、目录结构、团队配置、角色文件、Cursor 窗口、OCR Agent 坐标映射等；**须全部通过后才能启动巡检**。v2.9.16 起**快捷键机制已完全移除**，切换 Agent 全程通过 OCR 识别侧栏坐标后鼠标点击完成，无需配置任何快捷键。

## 常见问题

| 现象 | 处理 |
|------|------|
| **资源管理器仍显示蛇形/旧图标** | 多为 **图标缓存**；试改名 exe、换文件夹、注销重登或运行 `ie4uinit.exe -show`。 |
| **exe 只有几百 KB、无法运行** | 单文件 exe 正常应为 **约几十 MB**。若异常变小，勿在打包后再对 exe 做「改图标/写资源」工具，否则会截断末尾 PKG。图标只应在 `build.spec` / PyInstaller 的 `Copying icon` 阶段写入。 |
| 缺少 DLL / 模块 | 在 `build.spec` 的 `hiddenimports` 中补充模块名后重打 |
| 杀毒误报 | 单文件 EXE 易被启发式拦截，可加签名或改用 `onedir` 模式 |
| 体积过大 | 可在 `Analysis` 里加大 `excludes`，或不用 `--onefile`（需改 spec 为 onedir） |

当前 `build.spec` 为 **单文件 EXE**（`EXE(..., a.binaries, a.datas, ...)` 一体打包）。
