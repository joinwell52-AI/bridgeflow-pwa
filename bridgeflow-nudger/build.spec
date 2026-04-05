# -*- mode: python ; coding: utf-8 -*-
# PyInstaller — 单文件 EXE：码流（CodeFlow）Desktop
# 用法：在 bridgeflow-nudger 目录下执行  pyinstaller build.spec --noconfirm
# 产物：dist/CodeFlow-Desktop.exe

import os

try:
    # PyInstaller 注入的 SPECPATH 已是 .spec 所在「目录」（CONF['specpath']），不要再 dirname，否则 BASE 会偏到上一级，
    # 导致 panel/app.ico 找不到、icon=None、exe 仍为默认蛇形图标。
    BASE = os.path.abspath(SPECPATH)
except NameError:
    BASE = os.path.dirname(os.path.abspath(__file__))


# 图标：用绝对路径，避免相对路径在个别环境下解析异常
_APP_ICO_ABS = os.path.normpath(os.path.join(BASE, "panel", "app.ico"))
if not os.path.isfile(_APP_ICO_ABS):
    raise SystemExit(
        "打包失败：缺少 %s ，请放入码流（CodeFlow）应用图标后再打包。" % (_APP_ICO_ABS,)
    )


def _collect_datas():
    """只打包存在的文件，避免缺 logo/ico 时构建失败。"""
    out = []
    panel_dir = os.path.join(BASE, "panel")
    if os.path.isdir(panel_dir):
        for name in (
            "index.html",
            "qrcode.min.js",
            "logo-sm.png",
            "logo.png",
            "app.ico",
        ):
            p = os.path.join(panel_dir, name)
            if os.path.isfile(p):
                out.append((p, "panel"))
    tpl = os.path.join(BASE, "templates")
    if os.path.isdir(tpl):
        out.append((tpl, "templates"))
    return out


block_cipher = None

a = Analysis(
    ["main.py"],
    pathex=[BASE],
    binaries=[],
    datas=_collect_datas(),
    hiddenimports=[
        "pyautogui",
        "pyperclip",
        "win32gui",
        "win32con",
        "win32api",
        "win32ui",
        "win32process",
        "websockets",
        "websockets.legacy",
        "websockets.legacy.client",
        "winocr",
        "PIL",
        "PIL.Image",
        "PIL.ImageGrab",
        "cursor_vision",
        "watchdog",
        "watchdog.observers",
        "watchdog.events",
        "watchdog.utils",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["matplotlib", "numpy", "pandas", "tkinter.test"],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="CodeFlow-Desktop",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    # UPX 会压缩/改写 PE，易导致资源管理器中 exe 图标不显示或异常，桌面端关闭
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=_APP_ICO_ABS,
)
