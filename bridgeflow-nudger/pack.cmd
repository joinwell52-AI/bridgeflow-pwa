@echo off
REM 使用命令行 -i 指定图标（不能与 build.spec 同时传 -i，PyInstaller 会报错）
REM 等价于：pyinstaller main.py -w -F ... -i panel\app.ico
cd /d "%~dp0"

REM 无合法图标则禁止打包，避免生成默认蛇形 exe
py -3.12 require_app_ico.py
if errorlevel 1 exit /b 1

py -3.12 -m PyInstaller main.py -w -F -n CodeFlow-Desktop -i "panel\app.ico" --noconfirm --noupx --paths . ^
  --add-data "panel;panel" ^
  --add-data "templates;templates" ^
  --exclude-module matplotlib --exclude-module numpy --exclude-module pandas --exclude-module tkinter.test ^
  --hidden-import pyautogui ^
  --hidden-import pyperclip ^
  --hidden-import win32gui ^
  --hidden-import win32con ^
  --hidden-import win32api ^
  --hidden-import win32ui ^
  --hidden-import win32process ^
  --hidden-import websockets ^
  --hidden-import websockets.legacy ^
  --hidden-import websockets.legacy.client ^
  --hidden-import winocr ^
  --hidden-import PIL ^
  --hidden-import PIL.Image ^
  --hidden-import PIL.ImageGrab ^
  --hidden-import cursor_vision ^
  --hidden-import watchdog ^
  --hidden-import watchdog.observers ^
  --hidden-import watchdog.events ^
  --hidden-import watchdog.utils

if errorlevel 1 exit /b 1
echo.
echo 完成: dist\CodeFlow-Desktop.exe
