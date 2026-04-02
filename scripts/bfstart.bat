@echo off
chcp 65001 > nul
title BridgeFlow 安装启动

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║          BridgeFlow  一键安装启动                ║
echo  ║     手机主控台 + PC 执行机 + 文件协作桥接         ║
echo  ╚══════════════════════════════════════════════════╝
echo.

REM ── 切换到脚本所在目录（即项目目录）───────────────────────────────────────
cd /d "%~dp0"

REM ── [1/4] 检查 Python ────────────────────────────────────────────────────
echo  [1/4] 检查 Python 环境...
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ╔══════════════════════════════════════════════════╗
    echo  ║  ✗  未检测到 Python                             ║
    echo  ║                                                  ║
    echo  ║  请安装 Python 3.10 或以上版本：                 ║
    echo  ║    https://www.python.org/downloads/             ║
    echo  ║                                                  ║
    echo  ║  安装时必须勾选：Add Python to PATH              ║
    echo  ║  安装完成后重新双击本脚本即可                    ║
    echo  ╚══════════════════════════════════════════════════╝
    echo.
    start https://www.python.org/downloads/
    pause
    exit /b 1
)
for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo  ✓ Python %PYVER%

REM ── [2/4] 检查 Cursor ────────────────────────────────────────────────────
echo.
echo  [2/4] 检查 Cursor...

set CURSOR_FOUND=0

REM 检查进程（已在运行）
tasklist /FI "IMAGENAME eq Cursor.exe" /FO CSV /NH 2>nul | find "Cursor.exe" > nul
if %errorlevel% equ 0 (
    set CURSOR_FOUND=1
)

REM 检查默认安装路径
if %CURSOR_FOUND% equ 0 (
    if exist "%LOCALAPPDATA%\Programs\cursor\Cursor.exe" set CURSOR_FOUND=1
)
if %CURSOR_FOUND% equ 0 (
    if exist "%LOCALAPPDATA%\Programs\Cursor\Cursor.exe" set CURSOR_FOUND=1
)
if %CURSOR_FOUND% equ 0 (
    if exist "%USERPROFILE%\AppData\Local\Programs\cursor\Cursor.exe" set CURSOR_FOUND=1
)
if %CURSOR_FOUND% equ 0 (
    if exist "C:\Program Files\Cursor\Cursor.exe" set CURSOR_FOUND=1
)
REM 检查数据目录（安装过但不在默认路径）
if %CURSOR_FOUND% equ 0 (
    if exist "%LOCALAPPDATA%\Cursor" set CURSOR_FOUND=1
)
if %CURSOR_FOUND% equ 0 (
    if exist "%APPDATA%\Cursor" set CURSOR_FOUND=1
)

if %CURSOR_FOUND% equ 0 (
    echo.
    echo  ╔══════════════════════════════════════════════════╗
    echo  ║  ✗  未检测到 Cursor                             ║
    echo  ║                                                  ║
    echo  ║  BridgeFlow 依赖 Cursor 运行 AI 角色。           ║
    echo  ║  没有 Cursor，任务发出后将无人处理。             ║
    echo  ║                                                  ║
    echo  ║  请先安装 Cursor：https://cursor.com             ║
    echo  ╚══════════════════════════════════════════════════╝
    echo.
    echo  正在打开 Cursor 下载页面...
    start https://cursor.com
    echo.
    echo  安装 Cursor 后重新双击本脚本。
    pause
    exit /b 1
)
echo  ✓ Cursor 已安装

REM ── [3/4] 安装 / 升级 BridgeFlow ─────────────────────────────────────────
echo.
echo  [3/4] 安装 BridgeFlow（首次约需 10-30 秒）...
pip install --upgrade bridgeflow -q
if %errorlevel% neq 0 (
    echo.
    echo  ✗ 安装失败！可能原因：
    echo    - 网络不通（检查代理或 VPN）
    echo    - pip 版本过旧，请运行：python -m pip install --upgrade pip
    echo.
    pause
    exit /b 1
)
echo  ✓ BridgeFlow 安装完成

REM ── [4/4] 启动 BridgeFlow ────────────────────────────────────────────────
echo.
echo  [4/4] 启动 BridgeFlow...
echo.
bridgeflow run

REM ── 异常退出时暂停 ────────────────────────────────────────────────────────
if %errorlevel% neq 0 (
    echo.
    echo  ✗ 启动失败，错误代码：%errorlevel%
    echo  请截图以上内容发给技术支持。
    echo.
    pause
)
