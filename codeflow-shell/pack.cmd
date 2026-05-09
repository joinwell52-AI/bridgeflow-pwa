@echo off
:: ============================================================================
:: pack.cmd — Build CodeFlow-v0.1.0-rc.1.exe via Node SEA (Windows MVP).
::
:: Reference: TASK-20260509-028-PM-to-DEV §一 主交付 4
::            design doc §11.6 (pack.cmd) + §11.7 (Node SEA acceptance)
::            Node 22+ Single Executable Applications:
::            https://nodejs.org/api/single-executable-applications.html
::
:: Fallback: if any step below fails (Node SEA on this Windows host is still
:: maturing — §11.8 risk row 1), the script exits non-zero and the operator
:: should run `npm start` instead. This is acceptable for v0.1 internal RC.
:: ============================================================================
setlocal EnableDelayedExpansion

echo === CodeFlow-Shell pack (Windows / Node SEA) ===

:: --- step 1: typecheck (no emit) -------------------------------------------
:: Our tsconfig is `noEmit: true` (matches @codeflow/protocol + runtime style),
:: so step 1 only validates types. Compilation/bundling is done by esbuild
:: in step 2, going straight from src/main.ts -> dist/main.bundle.js.
echo [1/5] tsc typecheck (no emit)
call npx tsc --noEmit
if errorlevel 1 (
  echo Error: typecheck failed. See above for details.
  exit /b 1
)

if not exist dist mkdir dist

:: --- step 2: esbuild bundle -------------------------------------------------
:: Bundle src/main.ts + all dependencies into a single dist/main.bundle.js
:: so that Node SEA only needs to embed one file.
echo [2/5] esbuild bundle (src/main.ts -^> dist/main.bundle.js)
call npx esbuild src/main.ts --bundle --platform=node --target=node22 --format=cjs --outfile=dist/main.bundle.js
if errorlevel 1 (
  echo Error: esbuild bundle failed.
  echo Hint: if a native module ^(chokidar, fsevents, etc.^) is the cause,
  echo       try: npx ncc build src/main.ts -o dist/ncc-out
  exit /b 1
)

:: --- step 3: build SEA blob -------------------------------------------------
echo [3/5] build SEA blob (sea-config.json -^> dist/sea-prep.blob)
node --experimental-sea-config sea-config.json
if errorlevel 1 (
  echo Error: SEA blob build failed.
  echo Hint: requires Node 22+. Current node version:
  call node --version
  exit /b 1
)

:: --- step 4: copy node binary ----------------------------------------------
:: Resolve the active node.exe via `where node` (PM TASK-028 inline used
:: %ProgramFiles%\nodejs which is not always present, e.g. with nvm-windows
:: or chocolatey installs).
echo [4/5] copy node.exe -^> dist\CodeFlow-v0.1.0-rc.1.exe
for /f "delims=" %%i in ('where node') do (
  set "NODE_EXE=%%i"
  goto :found_node
)
echo Error: could not locate node.exe via `where node`.
exit /b 1
:found_node
echo       (using node binary: !NODE_EXE!)
copy /Y "!NODE_EXE!" "dist\CodeFlow-v0.1.0-rc.1.exe" > nul
if errorlevel 1 (
  echo Error: copy node.exe failed.
  exit /b 1
)

:: --- step 5: inject SEA blob into the EXE ----------------------------------
echo [5/5] postject inject (dist\sea-prep.blob -^> CodeFlow-v0.1.0-rc.1.exe)
call npx postject "dist\CodeFlow-v0.1.0-rc.1.exe" NODE_SEA_BLOB dist\sea-prep.blob ^
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
if errorlevel 1 (
  echo Error: postject failed.
  exit /b 1
)

echo.
echo === Build complete ===
echo Output: dist\CodeFlow-v0.1.0-rc.1.exe
echo Size  :
for %%F in (dist\CodeFlow-v0.1.0-rc.1.exe) do echo         %%~zF bytes
echo.
echo Try: dist\CodeFlow-v0.1.0-rc.1.exe
endlocal
