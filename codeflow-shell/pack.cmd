@echo off
:: ============================================================================
:: pack.cmd — codeflow-shell single-EXE packaging entry (v0.2.0-beta).
::
:: STATUS: spike-only stub. v0.2.0-beta keeps `npm start` as the OFFICIAL
::         distribution method. Single-EXE is DEFERRED to v1.0 pending the
::         re-eval conditions in `docs/design/spike-exe-packaging.md §4.2`.
::
:: Background:
::   - REPORT-20260509-028 §四 #1: pack.cmd v0.1 (Node SEA) failed at esbuild
::     with `import.meta.url` + `@cursor/sdk` ESM .d.ts.map errors.
::   - TASK-20260510-007-PM-to-DEV §四 P2 §1+§2: spike 5 packaging strategies;
::     if ALL fail, document `npm start` as official fallback and don't block P3.
::   - REPORT-20260510-007 §spike: all 7 evaluated strategies blocked by 3
::     root causes (cursor-sdk pure ESM + cursor-sdk's sqlite3 native dep +
::     monorepo workspace hoist mis-alignment). See spike doc §二 for full RCA.
::
:: This script:
::   1. By default — prints the spike summary + dispatches to `npm start`
::      so casual users get a working shell with one double-click.
::   2. Subcommand `bun` — runs the bun --compile spike (advance users only;
::      EXE will fail at runtime due to bindings/sqlite3 — see spike doc §三 #1).
::   3. Subcommand `sea-cjs` / `sea-esm` — runs the esbuild SEA spikes
::      (advance users only; same constraint).
::
:: Usage:
::   pack.cmd                   # default → npm start banner + dispatch
::   pack.cmd bun               # bun --compile spike (will fail at runtime)
::   pack.cmd sea-cjs           # esbuild CJS bundle spike
::   pack.cmd sea-esm           # esbuild ESM bundle spike
::   pack.cmd --help            # this banner
:: ============================================================================
setlocal EnableDelayedExpansion

set "MODE=%~1"
if "%MODE%"=="" set "MODE=default"

if /I "%MODE%"=="--help" goto :help
if /I "%MODE%"=="-h"     goto :help
if /I "%MODE%"=="help"   goto :help

if /I "%MODE%"=="default" goto :default
if /I "%MODE%"=="bun"     goto :spike_bun
if /I "%MODE%"=="sea-cjs" goto :spike_sea_cjs
if /I "%MODE%"=="sea-esm" goto :spike_sea_esm

echo Unknown mode: %MODE%
goto :help

:: ----------------------------------------------------------------------------
:default
echo ============================================================
echo  codeflow-shell pack.cmd (v0.2.0-beta)
echo ============================================================
echo.
echo  Single-EXE packaging is DEFERRED to v1.0.
echo  v0.2.0-beta distribution is `npm start` (this script will
echo  forward to it now). See:
echo.
echo    docs\design\spike-exe-packaging.md
echo.
echo  for the full RCA on why all 7 packaging strategies fail and
echo  the conditions to re-evaluate at v1.0 boundary.
echo.
echo  To run the spike attempts manually:
echo    pack.cmd bun        - bun --compile (fails at bindings)
echo    pack.cmd sea-cjs    - esbuild CJS bundle (fails at require ESM)
echo    pack.cmd sea-esm    - esbuild ESM bundle (fails at hoist)
echo.
echo ============================================================
echo  Forwarding to: npm start
echo ============================================================
echo.
call npm start
exit /b %ERRORLEVEL%

:: ----------------------------------------------------------------------------
:spike_bun
echo === [spike] bun build --compile ===
echo See: docs\design\spike-exe-packaging.md §三 #1
where bun >nul 2>nul
if errorlevel 1 (
  echo Error: bun is not installed. Install with: npm install -g bun
  exit /b 2
)
if not exist dist mkdir dist
call bun build --compile --target=bun-windows-x64 ./src/main.ts --outfile dist/codeflow-shell-bun.exe
if errorlevel 1 exit /b 1
echo.
echo Built: dist\codeflow-shell-bun.exe
echo NOTE: this EXE will fail at runtime with `bindings: Could not find
echo       module root` due to @cursor/sdk → sqlite3 → bindings native
echo       dep. See spike doc Blocker D.
exit /b 0

:: ----------------------------------------------------------------------------
:spike_sea_cjs
echo === [spike] esbuild CJS bundle + Node SEA ===
echo See: docs\design\spike-exe-packaging.md §三 #3
if not exist dist mkdir dist
call npx esbuild src/main.ts --bundle --platform=node --target=node22 ^
  --format=cjs --outfile=dist/main.bundle.cjs ^
  --external:@cursor/sdk --external:sqlite3 --external:bindings ^
  --define:import.meta.url=globalThis.__import_meta_url ^
  --banner:js="globalThis.__import_meta_url = require('url').pathToFileURL(__filename).href;"
if errorlevel 1 exit /b 1
echo.
echo Bundle written: dist\main.bundle.cjs
echo NOTE: `node dist\main.bundle.cjs` will fail with `Cannot find module
echo       '@cursor/sdk'` because CJS cannot require ESM-only packages.
echo       See spike doc Blocker B.
exit /b 0

:: ----------------------------------------------------------------------------
:spike_sea_esm
echo === [spike] esbuild ESM bundle + Node SEA ===
echo See: docs\design\spike-exe-packaging.md §三 #4
if not exist dist mkdir dist
call npx esbuild src/main.ts --bundle --platform=node --target=node22 ^
  --format=esm --outfile=dist/main.bundle.mjs ^
  --external:@cursor/sdk --external:sqlite3 --external:bindings
if errorlevel 1 exit /b 1
echo.
echo Bundle written: dist\main.bundle.mjs
echo NOTE: `node dist\main.bundle.mjs` will fail with `ERR_MODULE_NOT_FOUND
echo       Cannot find package '@cursor/sdk'` because @cursor/sdk is hoisted
echo       under packages\codeflow-runtime\node_modules\, not codeflow-shell\.
echo       See spike doc Blocker C.
exit /b 0

:: ----------------------------------------------------------------------------
:help
echo pack.cmd — codeflow-shell packaging entry (v0.2.0-beta spike-only)
echo.
echo Usage:
echo   pack.cmd                  default — banner + dispatch to `npm start`
echo   pack.cmd bun              spike: bun --compile (fails at runtime)
echo   pack.cmd sea-cjs          spike: esbuild CJS bundle (fails at require ESM)
echo   pack.cmd sea-esm          spike: esbuild ESM bundle (fails at hoist)
echo   pack.cmd --help           this message
echo.
echo See docs\design\spike-exe-packaging.md for the full RCA.
exit /b 0
