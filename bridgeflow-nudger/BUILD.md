# 打包码流（CodeFlow）Desktop（.exe）

与 **`CHANGELOG.md`** 中桌面端版本一致；当前 **`main.py` / `web_panel.py`** 版本号与发布说明同步。

## 环境

- Windows 10/11，**Python 3.12**（你当前环境；亦兼容 3.10+）
- 建议虚拟环境，避免污染全局

## 依赖

```powershell
cd D:\BridgeFlow\bridgeflow-nudger
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -U pip
pip install -r requirements.txt
pip install pyinstaller winocr
```

说明：**winocr** 用于 `cursor_vision` OCR；若只做无视觉盲操作，可不装 winocr，但需在 `build.spec` 里去掉对应 `hiddenimports`（不推荐）。

## 角色模板（dev-team）与主仓一致

首次配置/「复制模板」时，会把 `templates/agents/dev-team/*.md` 拷到客户项目的 `docs/agents/`。  
**文件名与巡检器引用一致**：`PM-01.md`、`DEV-01.md`、`QA-01.md`、`OPS-01.md`、`ADMIN-01.md`（及 `.en.md`）。  

发布前请从仓库 **`docs/agents/`** 同步到 **`bridgeflow-nudger/templates/agents/dev-team/`**（本仓库已对齐；若只改主仓文档，请再执行一次复制以免 EXE 内仍是旧版）。

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

（内部为：`py -3.12 -m PyInstaller main.py -w -F -n CodeFlow-Desktop -i panel\app.ico ...`，见 `pack.cmd`）

**方式 A（推荐，已按上文创建 venv）：**

```powershell
cd D:\BridgeFlow\bridgeflow-nudger
.\.venv\Scripts\Activate.ps1
pyinstaller build.spec --noconfirm
```

**方式 B（未建 venv，用系统 Python 3.12）：**

```powershell
cd D:\BridgeFlow\bridgeflow-nudger
py -3.12 -m PyInstaller build.spec --noconfirm
```

成功后：

- 输出：`dist\CodeFlow-Desktop.exe`（单文件，无控制台窗口）

## 运行

双击 `CodeFlow-Desktop.exe`，首次选择项目目录；与源码运行 `python main.py` 行为一致。

## 常见问题

| 现象 | 处理 |
|------|------|
| **资源管理器仍显示蛇形/旧图标** | 多为 **图标缓存**；试改名 exe、换文件夹、注销重登或运行 `ie4uinit.exe -show`。 |
| **exe 只有几百 KB、无法运行** | 单文件 exe 正常应为 **约几十 MB**。若异常变小，勿在打包后再对 exe 做「改图标/写资源」工具，否则会截断末尾 PKG。图标只应在 `build.spec` / PyInstaller 的 `Copying icon` 阶段写入。 |
| 缺少 DLL / 模块 | 在 `build.spec` 的 `hiddenimports` 中补充模块名后重打 |
| 杀毒误报 | 单文件 EXE 易被启发式拦截，可加签名或改用 `onedir` 模式 |
| 体积过大 | 可在 `Analysis` 里加大 `excludes`，或不用 `--onefile`（需改 spec 为 onedir） |

当前 `build.spec` 为 **单文件 EXE**（`EXE(..., a.binaries, a.datas, ...)` 一体打包）。
