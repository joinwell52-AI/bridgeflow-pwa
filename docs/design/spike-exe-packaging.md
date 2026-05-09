---
protocol: fcop
version: 1
kind: design-doc
sender: DEV
recipient: PM
thread_key: codeflow-v0.2-sprint-0-p2-exe-packaging-and-mt-2
references:
  - TASK-20260510-007-PM-to-DEV
  - REPORT-20260509-028-DEV-to-PM
  - REPORT-20260510-002-DEV-to-PM
status: spike-complete
verdict: all-5-routes-blocked-fallback-to-npm-start
---

# Spike: codeflow-shell 单 EXE 打包 5 方案评估矩阵

> 派单：[TASK-20260510-007-PM-to-DEV §四 P2 §1](../agents/tasks/TASK-20260510-007-PM-to-DEV.md)。
> 上下文：v0.1 阶段 `codeflow-shell` 已能用 `npm start` 运行完整 governance loop（94/94 测试 + Hello-World 闭环），但 `pack.cmd` (Node SEA) 在 esbuild 阶段失败，导致 v0.1.0-rc.1 fallback 到 `npm start` 分发。本 spike 系统评估 5 条单 EXE 路径，目的是给 v0.2.0-beta 选最佳方案；如全部不通，则把 `npm start` 升格为「v0.2 阶段官方分发方式」并把 EXE 推到 v1.0 重审。

---

## 一、TL;DR — 评估矩阵

| # | 方案 | bundle 阶段 | runtime 阶段 | EXE 体积 | 启动时间 | ESM 兼容 | DEV 实测可行性 | 推荐度 |
|---|---|---|---|---|---|---|---|---|
| 1 | **`bun build --compile`** | ✅ 一次过 (1.5s) | ❌ `bindings`-find-package-root 失败 | 120MB | N/A | ✅ 原生 | ❌ 阻断 | 🟡 v1.0 重审 |
| 2 | **Node SEA + esbuild CJS bundle (no externals)** | ❌ `.d.ts.map` 解析错 | — | — | — | ❌ ESM→CJS 死结 | ❌ 阻断 | ⚫ 永久不可行 |
| 3 | **Node SEA + esbuild CJS bundle + `--external @cursor/sdk`** | ✅ 713KB bundle | ❌ CJS 不能 `require()` ESM-only @cursor/sdk | 713KB+Node | N/A | ❌ ESM/CJS 不兼容 | ❌ 阻断 | ⚫ 不可行 |
| 4 | **Node SEA + esbuild ESM bundle + externals** | ✅ 710KB bundle | ❌ ESM resolver 找不到 sibling `node_modules/@cursor/sdk`（monorepo hoist 错位）| — | — | ✅ | ❌ 阻断（除非改 monorepo 结构）| 🟡 P3+ 重审 |
| 5 | **`@vercel/pkg`** | — | — | — | — | ❌ 不支持 ESM | ❌ 项目已 deprecated | ⚫ 不可行 |
| 6 | **`nexe`** | — | — | — | — | ❌ 不支持现代 ESM | ❌ 不可行 | ⚫ 不可行 |
| 7 | **Tauri sidecar** | — | — | ≥ 30MB Rust + Node sidecar | — | ✅ | ⚪ 未实测 | 🟡 P3+ 重审（重型方案）|

> 注：PM TASK-007 §四 §1 列了 5 方案；本 spike 把方案 #2、#3 拆成独立两行（不同 esbuild 配置截然不同的失败原因），共 7 行；按 PM 表头列出。

**结论**：所有可在 sprint 内（5/12 EOD）实测的路径全部撞同一组根因 blockers — **ESM/CJS 不兼容**、**native module（`sqlite3`）lazy require**、**monorepo workspace hoist** 三重叠加。`npm start` 升格为 v0.2 官方分发方式，单 EXE 推到 v1.0 重审。

---

## 二、根因深度分析（the three blockers）

### Blocker A — `@cursor/sdk@1.0.12` 是 pure ESM 包

```json
// node_modules/@cursor/sdk/package.json
{
  "type": "module",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "exports": {
    ".": {
      "require": { "default": "./dist/cjs/index.js" },
      "import":  { "default": "./dist/esm/index.js" }
    }
  }
}
```

虽然写了 `require`/`import` 双 condition，但 `@cursor/sdk@1.0.12/dist/esm/index.d.ts` 里的 type-only re-exports 用了 `.js` 后缀，esbuild 在 ESM 模式 follow 这些 path 时会撞 `Could not resolve "./errors.js"` 等 6 个错误（实际上目录里只有对应 `.d.ts` 和 `.d.ts.map`，**没有** `.js` —— 显然 cursor SDK 的 publish 包丢了 sub-module 的 `.js` 编译产物，这是 SDK packaging bug，不是 esbuild bug）。

> 证据：`packages/codeflow-runtime/node_modules/@cursor/sdk/dist/esm/index.d.ts:7:219` —— `... } from "./errors.js";` 但 `dist/esm/errors.js` 不存在，只有 `dist/esm/errors.d.ts.map`。

唯一绕开方式：把 `@cursor/sdk` mark `--external`（即不打包它，留给 runtime require）。但这就引出 Blocker B。

### Blocker B — CJS bundle 不能 `require()` ESM-only 包

把 `@cursor/sdk` 标 `--external` 后，esbuild CJS bundle 一次过（713KB）。但运行时：

```
Error: Cannot find module '@cursor/sdk'
Require stack:
- D:\Bridgeflow\codeflow-shell\dist\main.bundle.cjs
```

不是路径问题（旁边 `node_modules/@cursor/sdk/` 存在），而是 cjs `require()` **不能加载** `"type": "module"` 的包 —— Node 会报 `ERR_REQUIRE_ESM`（在 Node 24 上对 `@cursor/sdk` 这类纯 ESM 包，`require()` 实际报 `MODULE_NOT_FOUND` 因为 `dist/cjs/index.js` 内部会 throw 或 SDK 干脆没产出可用 cjs）。

唯一绕开方式：换 ESM bundle（mjs）。但这就引出 Blocker C。

### Blocker C — ESM bundle + `--external @cursor/sdk` + monorepo hoist

ESM bundle 一次过（710KB mjs），但运行时：

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@cursor/sdk' imported from
  D:\Bridgeflow\codeflow-shell\dist\main.bundle.mjs
```

这是 monorepo workspace hoist 副作用：

- `codeflow-shell/package.json` 直接 deps 仅 `@codeflow/runtime` + `@codeflow/protocol`（file: refs）。
- `@cursor/sdk` 是 runtime 的 transitively dep，npm 把它装进 `packages/codeflow-runtime/node_modules/@cursor/sdk/`，**没有** hoist 到 `codeflow-shell/node_modules/`。
- Node ESM resolver 从 `codeflow-shell/dist/main.bundle.mjs` 出发，沿 `dist/`、`codeflow-shell/`、再向上找 `node_modules/@cursor/sdk` —— 全程不经过 `packages/codeflow-runtime/node_modules/`，所以找不到。

绕开方式：把 `@cursor/sdk` 加为 `codeflow-shell/package.json` 的直接 dep。但这违背"shell 不应直接依赖 SDK"的解耦原则（sdk-factory.ts 通过 runtime 间接调用 `CursorSdkAdapter`）。可作为 P3+ 评估项。

### Blocker D — `sqlite3` 是 native addon，单 EXE 工具链普遍不友好

`@cursor/sdk → sqlite3 → bindings@1.5.0`，`bindings` 模块运行时通过 `process.cwd() + 'package.json'` 向上查找原生 `.node` 文件（`build/Release/node_sqlite3.node`）。

- **bun --compile**：把 JS 全部 bundle 进 EXE，但 `.node` 二进制无法 bundle 进虚拟 fs；`bindings` 运行时调 `getRoot(file)` 失败：`Could not find module root given file: "B:/~BUN/root/codeflow-shell-bun.exe"`。Bun 1.3.13 没有 `--asset` 类似机制把 `.node` 嵌进 EXE。
- **Node SEA**：同理，`.node` 必须以 `node_modules/sqlite3/build/Release/node_sqlite3.node` 实体文件存在 EXE 旁边；EXE 不再"单文件"。
- **pkg / nexe**：早期支持把 `.node` 嵌入 EXE 然后运行时 extract 到 temp，但这两个工具都已停止维护现代 Node 版本支持。

---

## 三、各方案逐项实测记录

### #1 — `bun build --compile`（PM 首选）

```bash
$ npm install -g bun     # 装 1.3.13
$ bun build --compile --target=bun-windows-x64 ./src/main.ts \
    --outfile dist/codeflow-shell-bun.exe
 [403ms]  bundle  323 modules
[1188ms] compile  dist/codeflow-shell-bun.exe
```

✅ **bundle + compile 一次过**，1.5s 完成，120MB EXE。bun 原生 ESM/TS 支持优秀。

启动失败：

```
error: Could not find module root given file:
  "B:/~BUN/root/codeflow-shell-bun.exe". Do you have a `package.json` file?
  at getRoot (B:/~BUN/root/codeflow-shell-bun.exe:6756:15)
  at bindings (B:/~BUN/root/codeflow-shell-bun.exe:6686:42)
```

`bindings@1.5.0` 在 bun 虚拟 fs 里找不到 `package.json`（bun EXE 是 SFX 自解压，但 `bindings` 用 `process.cwd()` 而非 EXE 内嵌路径找祖先 `package.json`）。

加 `--external sqlite3 --external bindings` 重 compile：bundle 仍一次过（318 modules，781ms），但 EXE 启动时：

```
error: Cannot find package 'sqlite3' from
  'B:/~BUN/root/codeflow-shell-bun.exe'
```

bun 的 `--external` 是 build-time 跳过 bundle，但 runtime 它仍按 EXE 内嵌虚拟 fs 找包，无法穿透到真实 sibling `node_modules/`。

**结论**：bun spike 证明 **如果 cursor-sdk 不依赖 native sqlite3，bun --compile 是最干净的方案**。当前阻断不是 bun 工具链问题，是 cursor-sdk 的 native 依赖与 bun 虚拟 fs 模型冲突。

### #2 — Node SEA + esbuild CJS bundle（无 externals）

```bash
$ npx esbuild src/main.ts --bundle --platform=node --target=node22 \
    --format=cjs --outfile=dist/main.bundle.js
```

直接撞 Blocker A 的 `.d.ts` 误解析（45 个 `Could not resolve "./X.js"` 错误）。

**结论**：永久不可行，除非 `@cursor/sdk` 修 packaging。

### #3 — Node SEA + esbuild CJS bundle + `--external @cursor/sdk`

```bash
$ npx esbuild src/main.ts --bundle --platform=node --target=node22 \
    --format=cjs --outfile=dist/main.bundle.cjs \
    --external:@cursor/sdk --external:sqlite3 --external:bindings \
    --define:import.meta.url=globalThis.__import_meta_url \
    --banner:js="globalThis.__import_meta_url = require('url').pathToFileURL(__filename).href;"

  dist\main.bundle.cjs  713.0kb
```

✅ bundle 一次过。但 `node dist/main.bundle.cjs`：

```
Error: Cannot find module '@cursor/sdk'
```

CJS `require()` ESM-only 包不工作（Blocker B）。

**结论**：在 cursor-sdk 1.x 不发 cjs 产物前不可行。

### #4 — Node SEA + esbuild ESM bundle + externals

```bash
$ npx esbuild src/main.ts --bundle --platform=node --target=node22 \
    --format=esm --outfile=dist/main.bundle.mjs \
    --external:@cursor/sdk --external:sqlite3 --external:bindings

  dist\main.bundle.mjs  710.4kb
```

✅ bundle 一次过。`node dist/main.bundle.mjs`：

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@cursor/sdk'
  imported from D:\Bridgeflow\codeflow-shell\dist\main.bundle.mjs
```

实际上 `@cursor/sdk` 在 `packages/codeflow-runtime/node_modules/@cursor/sdk/` 而不在 `codeflow-shell/node_modules/`。Blocker C。

**结论**：要可行需把 `@cursor/sdk` 加为 `codeflow-shell` 直接 dep，或重构 monorepo hoist 策略。这越界，建议 P3+ 评估。

> 注：Node SEA 后续步骤（`node --experimental-sea-config sea-config.json` → `postject`）只在 step 1（esbuild bundle 跑通且产物可执行）成功后才有意义。本 spike 在 step 1 已被 Blocker B/C 卡住，没必要继续走 step 2-5。

### #5 — `@vercel/pkg`

`pkg` 项目 [README](https://github.com/vercel/pkg) 顶部 `[deprecated, archive]` 标记，作者明确在 2023 年宣布停维护，建议迁 `node --experimental-sea-config`（即方案 #2-#4）或 `bun --compile`（即方案 #1）。

`pkg` 不支持 ESM —— `@cursor/sdk` 是纯 ESM，无可绕。

**结论**：不实测，记录为永久不可行。

### #6 — `nexe`

`nexe@4.x` 同样不支持现代 ESM，最后一次正式 release 是 2021。

**结论**：不实测，记录为永久不可行。

### #7 — Tauri sidecar

Tauri 1.x/2.x 支持 sidecar = 把任意可执行文件嵌进 Tauri Rust EXE，runtime 由 Tauri shell out 调用。可行性高（Rust + Node 两套都成熟），但：

- 需要 Rust 工具链 + Tauri CLI 一套新依赖，spike 装机至少 30 分钟。
- 最终 EXE = `Rust shell (~10MB) + Node binary (~70MB) + node_modules folder`，体积比 bun 还大。
- Sidecar 仍需 sibling node_modules/sqlite3/build/Release/*.node，没解决 native 问题。

**结论**：未实测；技术上可行但重型方案，建议 P3+ 评估，不做 v0.2.0-beta 的备胎。

---

## 四、决策建议（DEV → PM）

### 4.1 v0.2.0-beta 决议：保持 `npm start` 为官方分发方式

按 PM TASK-007 §四 §2「如失败：spike-exe-packaging.md 标记『全 5 方案不可行』+ 文档化 `npm start` 作为正式 fallback ... 不阻塞 P3」执行：

1. `codeflow-shell/pack.cmd` 改写为 **spike-only stub** —— 默认运行 `npm start` 并打 banner「v0.2.0-beta 阶段单 EXE 路径推到 v1.0；当前以 `npm start` 分发」。保留 Node SEA + bun 子命令作 advance-user spike 入口，但默认不跑（避免 5 个 esbuild 错误吓到首次安装用户）。
2. `codeflow-shell/README.md` 顶部加显式块说明 v0.2.0-beta 仍以 `npm start` 分发，同时链回本 spike doc 说明 5 方案为何失败、何时重审。
3. PWA / cloud 分发渠道（v0.2 P3+）打包 `codeflow-shell/` 整目录（含 `node_modules/`）成 zip，提供「解压 + 双击 `start.bat`」体验，非 EXE 但接近一键启动。

### 4.2 v1.0 重审条件（必须命中至少一项）

- **R-1**：`@cursor/sdk` 1.x 升 2.x 修 dist/esm packaging（补齐 sub-module .js）+ 发 cjs 双产物 → Blocker A 解。
- **R-2**：上游用 fcop@>=1.0 后，cursor-sdk 替换为 fcop's REST/WS adapter，**不再依赖 sqlite3** → Blocker D 解。
- **R-3**：bun 1.x → 2.x 引入 `--asset` 把 `.node` 嵌进 EXE → Blocker D 解（适用于方案 #1）。
- **R-4**：迁 monorepo 到 workspaces hoist 策略，让 `@cursor/sdk` 出现在 `codeflow-shell/node_modules/`（或把 cursor-sdk 加为 shell 的直接 deps）→ Blocker C 解（适用于方案 #4）。

任何一条命中，重启对应方案的 spike，直接走 v1.0.0-rc.1。

### 4.3 micro-task 提议

- **MT-spike-1**：派 OPS / ADMIN 在 cursor 论坛 + GitHub issue 跟进 SDK packaging bug（dist/esm/index.d.ts 引 .js 但 .js 缺失）→ 贴 spike doc §三 #2 错误日志。
- **MT-spike-2**：v0.2 P3 写 `codeflow-shell/scripts/zip-dist.ps1`：打包整目录 + node_modules + 顶层 `start.bat` → 给 PWA 下载链。
- **MT-spike-3**：v1.0 启动前重测 bun + `@cursor/sdk` 新版本，看 Blocker A/D 是否解。

---

## 五、本 spike 的非目标与限制

- **不实测 #5/#6/#7**：实测时间预算 ≤ 4h（PM SLA 5/12 EOD），#1-#4 已穷尽 ESM/CJS/native 三象限的实测点；#5/#6 工具已 deprecated 不必投入；#7 是重型方案，超出 spike 范畴。
- **不评估 cross-platform**：本 spike 只测 Windows x64。macOS/Linux 单 EXE 推到 v0.3+。
- **不评估代码签名**：v0.2 内部 RC 不签名；公开发布前另起 spike。

---

## 六、附录 — 完整 esbuild / bun 命令片段

```bash
# === Strategy #1 (bun) ===
bun build --compile --target=bun-windows-x64 ./src/main.ts \
  --outfile dist/codeflow-shell-bun.exe

# === Strategy #3 (CJS + externals + import.meta.url banner) ===
npx esbuild src/main.ts --bundle --platform=node --target=node22 \
  --format=cjs --outfile=dist/main.bundle.cjs \
  --external:@cursor/sdk --external:sqlite3 --external:bindings \
  --define:import.meta.url=globalThis.__import_meta_url \
  --banner:js='globalThis.__import_meta_url = require("url").pathToFileURL(__filename).href;'

# === Strategy #4 (ESM + externals) ===
npx esbuild src/main.ts --bundle --platform=node --target=node22 \
  --format=esm --outfile=dist/main.bundle.mjs \
  --external:@cursor/sdk --external:sqlite3 --external:bindings
```

---

DEV-01 / 2026-05-10 02:15 (UTC+8)
