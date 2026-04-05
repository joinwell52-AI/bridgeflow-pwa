# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[('panel', 'panel'), ('templates', 'templates')],
    hiddenimports=['pyautogui', 'pyperclip', 'win32gui', 'win32con', 'win32api', 'win32ui', 'win32process', 'websockets', 'websockets.legacy', 'websockets.legacy.client', 'winocr', 'PIL', 'PIL.Image', 'PIL.ImageGrab', 'cursor_vision', 'watchdog', 'watchdog.observers', 'watchdog.events', 'watchdog.utils'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['matplotlib', 'numpy', 'pandas', 'tkinter.test'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='CodeFlow-Desktop',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['panel\\app.ico'],
)
