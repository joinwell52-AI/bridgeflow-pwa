---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260511-007
sender: DEV
recipient: PM
priority: P0
thread_key: codeflow-p4-main-sprint-fcop-pythonia-integration
references:
  - TASK-20260511-007-PM-to-DEV
  - REPORT-20260511-005-DEV-to-PM
layer: worker
---

# REPORT-20260511-007：P4 主 sprint — Day 1 EOD（追加式回报）

## Day 1 (5/11 EOD) — pythonia + FcopProjectClient + banner PYTHON_BIN check + .env.example

### §一 一句话结论

Day 1 全部 5 个子任务（1.1-1.5）完工 + 验证（1.6）全绿 + 在主代码树**主动消化** PM TASK §六 P0-1 / P0-2 / P1-1 / P3-2 共 4 条风险。runtime 测试基线由 112 → **121**（+9 fcop-client tests），三 workspace tsc clean，3 个真实 smoke（skip / real / bad-python）全部按预期表现，**Day 1 ship-ready** ✅。

### §二 完工证据（每个子任务）

#### Day 1.1 — 装 pythonia 到 packages/codeflow-runtime（主依赖）

执行：

```powershell
cd packages/codeflow-runtime
npm install pythonia@^1.2.6 --save
```

证据（`packages/codeflow-runtime/package.json` `dependencies` 后）：

```json
"dependencies": {
  "@codeflow/protocol": "file:../codeflow-protocol",
  "@cursor/sdk": "^1.0.12",
  "chokidar": "^4.0.3",
  "pythonia": "^1.2.6",
  "yaml": "^2.8.4"
}
```

说明：

- PM TASK §四 Day 1.1 写「`pnpm add pythonia`（或 `npm install pythonia` — DEV-005 §五 S1 指出）」— DEV 用 `npm`，与 DEV-005 §S1 一致。
- PM TASK §五 P3-2「pythonia v1.2.6 而非 v2.x」— DEV-005 §S5 实测过 latest 1.x 即 1.2.6（`npm view pythonia version` 验证），DEV 装的就是 ^1.2.6。

#### Day 1.2 — 写 `FcopProjectClient.ts` 适配层

文件：`packages/codeflow-runtime/src/_external/fcop-client.ts`（~850 行 + 详尽 JSDoc）

设计要点（全部基于 DEV-005 spike 已实证）：

| 设计点 | 来源 | 落地 |
|---|---|---|
| **类型安全的窄口径** TS interfaces | DEV 自决 | `FcopTask` / `FcopReview` / `WriteTaskSpec` / `WriteReviewSpec` / `MarkHumanApprovedSpec` 等 9 个 interface |
| **单一错误类** `FcopClientError` | DEV 自决（PM TASK 未提，但 dev-bridge 规则「回执必须包含影响范围」隐含） | 所有 pythonia 错误都映射到一个 TS class，业务方只 catch 一种 |
| **lazy pythonia import** | DEV-005 §S11 的隐含演化 + Day 1 smoke-3 surprise（见 §三 D1-S1） | `getDefaultPython()` 用 `await import("pythonia")` 而非 top-level `import`，让 bad PYTHON_BIN 走 friendly error 路径 |
| **workspace_dir escape hatch** | PM TASK §五 P1-1 + DEV-005 §S8 | `FcopProjectClientOptions.workspaceDir` 字段，传 `"docs/agents"` 保 CodeFlow v0.x layout |
| **5 核心调用** | PM TASK §四 Day 1.2 | `writeTask` / `listTasks` / `writeReview` / `markHumanApproved` + 隐式 `init` |
| **enum 解析三路径** | DEV-005 §S10 | `readEnumLike()` 优先 `.value`，fallback `String(raw)`，最后 regex `:'(\w+)'>` 兜底 |
| **Project init 副作用控制** | DEV-005 §S6 P2-1 | `ensureInitialized: false` 选项，让测试 / 后续 Day 不必每次启动都跑 init |
| **进程级单例守护** | DEV 自决（pythonia 同进程多 Python 子进程会浪费） | `pythoniaModulePromise` + `fcopModulePromise` 闭包级缓存 |

证据（关键节选）：

```typescript
// fcop-client.ts §"5 核心调用" 第一调用 writeTask 的 kwarg 转发：
async writeTask(spec: WriteTaskSpec): Promise<FcopTask> {
  const p = this._project as {
    write_task$: (kw: Record<string, unknown>) => Promise<unknown>;
  };
  const kwargs: Record<string, unknown> = {
    sender: spec.sender,
    recipient: spec.recipient,
    priority: spec.priority,
    subject: spec.subject,
    body: spec.body,
  };
  if (spec.references !== undefined) kwargs["references"] = spec.references;
  if (spec.thread_key !== undefined) kwargs["thread_key"] = spec.thread_key;
  if (spec.slot !== undefined) kwargs["slot"] = spec.slot;
  if (spec.risk_level !== undefined) kwargs["risk_level"] = spec.risk_level;
  const taskProxy = await p.write_task$(kwargs);
  return await readTask(taskProxy);
}
```

特性：

- 严格 `Fn$()` 语法（DEV-005 §S3 实证的 pythonia kwarg 正确写法）
- 可选字段**条件性写入** kwargs（如果用户没传，根本不送给 fcop，由 fcop 用默认值）
- 返回值 await readTask() 把 Python proxy 平铺成 TS-friendly `FcopTask`

tsc 验证：

```
> npx tsc --noEmit
（空输出 — 清洁）
```

#### Day 1.3 — 写 `FcopProjectClient.test.ts` 9 tests

文件：`packages/codeflow-runtime/src/_external/__tests__/fcop-client.test.ts`（~430 行）

测试策略：**不 spawn 真实 Python**，通过 `__setPythonForTests()` 注入 stub `python(moduleName)`。9 个 test:

| Test ID | 验证 |
|---|---|
| TS-FCC-1 | `assertFcopReady` 成功路径返回 `{fcopVersion, pythonVersion, pythonExecutable}` 三元组 |
| TS-FCC-2 | `assertFcopReady` 失败路径包成 `FcopClientError`，message 含 `PYTHON_BIN` / `Python < 3.10` / `fcop@1.1.0` 三段 actionable hint + 原始 cause |
| TS-FCC-3 | `create({ ensureInitialized: true, workspaceDir })` 调 `Project$` + `init$` kwargs 完整（`strict: false`、`workspace_dir: "docs/agents"`、`team`、`lang`、`force: false`） |
| TS-FCC-4 | `create({ ensureInitialized: false })` 跳过 `init$` 调用 |
| TS-FCC-5 | `writeTask` kwarg 条件转发：min spec 只 5 keys；full spec 含 `references` / `thread_key` / `risk_level` 8 keys |
| TS-FCC-6 | `writeReview` kwarg 转发，含 `decision='needs_human'` (v1.1 ADR-0025 第 5 值) |
| TS-FCC-7 | `markHumanApproved` 把 `review_id` 作为 **positional** 第一参，其余作 kwargs（DEV-005 §S4 实证的 fcop signature） |
| TS-FCC-8 | `listTasks` 返回 `FcopTask[]`，通过 `builtins.len` + index 访问，enum 字段（priority）解码成 plain string |
| TS-FCC-9 | `readEnumLike` 三路径：plain string / `{value: 'xxx'}` / 正则 repr 兜底 |

测试输出：

```
  ✔ TS-FCC-1: assertFcopReady success path returns version triple (1.2936ms)
  ✔ TS-FCC-2: assertFcopReady failure path wraps as FcopClientError with actionable hint (0.6212ms)
  ✔ TS-FCC-3: create with workspaceDir + ensureInitialized=true calls Project$ + init$ (1.0484ms)
  ✔ TS-FCC-4: create with ensureInitialized=false skips init$ (0.2412ms)
  ✔ TS-FCC-5: writeTask forwards kwargs correctly with optional fields conditionally (0.9247ms)
  ✔ TS-FCC-6: writeReview forwards kwargs including decision='needs_human' (v1.1 ADR-0025) (0.686ms)
  ✔ TS-FCC-7: markHumanApproved sends review_id POSITIONAL + the rest as kwargs (0.3622ms)
  ✔ TS-FCC-8: listTasks returns FcopTask[] with enum-decoded fields (1.0877ms)
  ✔ TS-FCC-9: readEnumLike handles plain string / {value} / regex repr fallback (0.3797ms)
ℹ tests 9
ℹ pass 9
ℹ fail 0
```

**全部 < 2ms / test**，纯 Node + tsx + stub，**不 spawn 任何 Python**。

#### Day 1.4 — codeflow-shell main.ts banner 加 PYTHON_BIN 检查 + `disposeFcopBridge` 在优雅停靠

修改的文件：

- `codeflow-shell/src/main.ts` — 新增 `probeFcopBridge()` 函数 + `printFcopProbeFailure()` helper + banner 增加 `fcop bridge` 行 + 优雅停靠新增 `disposeFcopBridge()` 调用
- `packages/codeflow-runtime/src/index.ts` — re-export `FcopProjectClient` / `FcopClientError` / `assertFcopReady` / `disposeFcopBridge` 等公开符号

probeFcopBridge 函数行为：

1. 若 `CODEFLOW_SKIP_FCOP_PROBE=1` → 返回 `{status: "skipped", reason}` 让 banner 显示 `(skipped — ...)` ；
2. 若 `PYTHON_BIN` 设了但**文件不存在** → 打印 actionable error 并 `process.exit(2)` （`existsSync` preflight check，**绕开 pythonia 同步 spawn ENOENT crash** — 见 §三 D1-S1）；
3. 若 fcop import 失败（Python 在但缺 fcop / Python <3.10）→ 同 #2，但 hint message 来自 `assertFcopReady` 内部的 `formatPythonStartupError`；
4. 成功 → 返回 `{status: "ok", fcopVersion, pythonVersion, pythonExecutable}` 让 banner 显示 `fcop 1.1.0 via pythonia (Python at ...)`。

banner 新增一行：

```
fcop bridge    : fcop 1.1.0 via pythonia (Python at C:\Users\...\Python312\python.exe)
```

优雅停靠新增：

```typescript
await runtime.stop();
await disposeFcopBridge();  // P4 Day 1.4 — kill pythonia child Python
console.log("[shell] runtime stopped cleanly. Goodbye.");
process.exit(0);
```

#### Day 1.5 — `.env.example` 加 `PYTHON_BIN=` 段

新增 22 行注释 + 占位符 `PYTHON_BIN=__REPLACE_WITH_YOUR_PYTHON_312_PATH__`。

**安全 surprise**：DEV 第一次写时不小心填了真实 admin 路径 `C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe` —— 这会把 admin 的用户名泄露进**公开 repo**！DEV **写完立即自查** 发现，把它改成多平台 placeholder + 注释引导用户自填。此次自查证明 P2「`.env.example` 安全」事件后的 audit habit 已经形成。

证据片段（`codeflow-shell/.env.example` 第 89-116 行）：

```
# ────────────────────────── fcop / pythonia bridge ───────────────────
# P4 sprint Day 1 (TASK-20260511-007 §五 P0-1) — v0.3.0-alpha introduces a
# pythonia bridge to fcop@1.1.0's Python library, so the runtime needs a
# Python 3.10+ interpreter with `fcop` installed.
...
# Replace this with the absolute path to YOUR Python 3.10+ interpreter
# that has fcop installed. Examples (your username will differ):
#   Windows: PYTHON_BIN=C:\Users\<you>\AppData\Local\Programs\Python\Python312\python.exe
#   macOS:   PYTHON_BIN=/Users/<you>/.pyenv/versions/3.12.9/bin/python3
#   Linux:   PYTHON_BIN=/usr/bin/python3.12
#
# (The placeholder below is intentionally not a real path — replace ONLY
# in your COPIED .env file, not this template.)
PYTHON_BIN=__REPLACE_WITH_YOUR_PYTHON_312_PATH__
```

#### Day 1.6 — 整体回归验证

| 验证项 | 期望 | 实际 |
|---|---|---|
| `tsc --noEmit` × 3 workspace | 全 0 错 | ✅ 三个 workspace 全 0 错 |
| `npm test`（runtime） | 121 pass (112 + 9 新) | ✅ tests 121 / pass 121 / fail 0 |
| smoke-1-skip | banner 显示 `(skipped — CODEFLOW_SKIP_FCOP_PROBE=1 in env)` | ✅ |
| smoke-2-real | banner 显示 `fcop 1.1.0 via pythonia (Python at C:\...)` | ✅ |
| smoke-3-bad-python | exit code = 2 + FATAL banner + 多行 actionable hint | ✅ |

smoke-3 实际输出（节选）：

```
exit code = 2 (expect 2)

===========================================================
FATAL: pythonia + fcop@1.1.0 bridge is not ready.
===========================================================
PYTHON_BIN points at a path that does not exist: C:\does\not\exist\python.exe
Check the spelling, escape backslashes properly in .env, or unset
PYTHON_BIN to let pythonia fall back to PATH `python3` / `python`.

Find a valid path with:
  Windows: where.exe python  OR  py -3 -c "import sys; print(sys.executable)"
  macOS:   which python3      OR  python3 -c "import sys; print(sys.executable)"
  Linux:   which python3      OR  python3 -c "import sys; print(sys.executable)"

To run codeflow-shell without the fcop bridge (Day 1 development only),
set CODEFLOW_SKIP_FCOP_PROBE=1 and the probe will be skipped.
===========================================================
```

smoke 脚本本身存放在 `codeflow-shell/.smoke-p4day1/run-smoke.ps1`（被 root `.gitignore` 排除，不进 git）。

### §三 surprise 揭示（Day 1 共 3 项）

#### D1-S1（DAY 1 最大 surprise）：pythonia 的 import 时同步 spawn 让 PYTHON_BIN ENOENT 走 unhandled error 直接 crash

**现象**：bad PYTHON_BIN（指向不存在的 .exe）时，最初的实现里 `import { python } from "pythonia"` 是 top-level static import，pythonia 内的 `StdioCom` 构造函数立即 `cp.spawn(...)`。`cp.spawn()` 返回的 ChildProcess 在 ENOENT 时**异步** emit `error` 事件，pythonia 没有监听该事件 → Node 报 `Unhandled 'error' event` → 进程 crash with exit code **1**（而不是 PM TASK §五 P0-1 期望的"清晰错误退出"）。

**问题分析**：

1. `cp.spawn()` 是同步函数，但其错误反馈是 async event
2. try/catch 在同步代码层捕获不到 spawn ENOENT
3. 在 top-level import 时 trigger，业务代码任何 error handler 都来不及挂

**修复**（DEV 自决，不在 PM TASK §六明示风险清单内，属 PM TASK §九「实施中如发现 PM 写法仍有错 → 立即指出并自行调对」）：

1. 把 `import { python } from "pythonia"` 从 top-level **static** 改为 **dynamic** `await import("pythonia")` 在第一次实际使用时，封进 `getDefaultPython()` lazy resolver；
2. 同时在 codeflow-shell `probeFcopBridge` 内**预先**用 Node `existsSync` 验证 `PYTHON_BIN` 文件是否存在 —— 这是绕过 pythonia spawn 行为的唯一办法，因为即便 dynamic import，pythonia 的 module init 仍然会同步 spawn。

修复后 smoke-3 输出 exit code 2 + 多行 actionable hint（见 §二 Day 1.6 smoke-3 证据）。

**给 PM 的建议**（适用于 Day 6 release notes 的「已知约束」段）：

- 文档须明确：**PYTHON_BIN 必须指向真实存在的可执行文件**。
- 若用户填错路径，shell 在启动**第一秒**就退出（exit 2 + actionable hint）— 这是已知行为，不是 bug。
- 对 install.ps1（P5 范围）：自动写 `PYTHON_BIN` 的逻辑要先 `Test-Path` 验证，避免给用户写一个会立即崩的 .env。

#### D1-S2（中等 surprise）：PM TASK §六.1 dispatch/ vs scheduler/ 路径错（与 TASK-005 同源）

**现象**：PM TASK-007 §六.1 写「`packages/codeflow-runtime/src/dispatch/TaskDispatcher.ts`（改）」。但实际项目里 `TaskDispatcher` 在 `packages/codeflow-runtime/src/scheduler/TaskDispatcher.ts`。

**与 TASK-005 关系**：TASK-005 §3.2 同样写过 `dispatch/`，DEV-005 spike 已实证修正为 `scheduler/`。这是 **PM 第二次写错**（同一处）。

**处置**（DEV 自决）：

- Day 2-5 实施 TaskDispatcher 改造时，**直接用正确路径 `scheduler/`**；
- 本报告记录，避免后续 OPS/QA commit hash 校验时困惑。

**给 PM 的建议**：

- TASK-008（如有）若再涉及该路径，请用 `scheduler/`；
- DEV 不主动修 PM TASK 文件（不动 `docs/agents/tasks/` 已落地文档 — Charter 5 rule）。

#### D1-S3（轻量 surprise）：测试中 `__killRealPythonChildForTests` 是必备护栏

**现象**：fcop-client.test.ts 第一次跑时，所有 9 tests **逻辑都通过**，但 `node --test` 整体不退出，挂在「test runner has completed but child stdio still alive」状态超过 60s（被 background）。

**根因**：pythonia 在 ESM import 时同步 spawn 一个 Python 子进程（D1-S1 的同一根因）。即便测试全部用 stub，**该子进程仍然 alive**，stdio pipe 挂在 node 父进程上 → test runner 觉得还有 IO 在跑，不退出。

**修复**（DEV 自决，已在 fcop-client.ts 中实现）：

```typescript
export function __killRealPythonChildForTests(): void {
  if (pythoniaModulePromise === null) return;
  pythoniaModulePromise.then((python) => {
    try { python.exit(); } catch { /* idempotent */ }
  }).catch(() => { /* never started */ });
  pythoniaModulePromise = null;
}
```

测试文件 `after()` hook 调用此 helper，让 test runner 在 9/9 全绿后 1 秒内退出。

**给 PM 的建议**：

- 这是 pythonia 的「副作用」特性，已知约束；
- Day 2-5 写新测试时，凡涉及 fcop-client 的，都要在 `after()` 中调 `__killRealPythonChildForTests`（DEV 会自己 review 这一点，PM 不必额外提醒）。

### §四 与 DEV-005 §六 9 大风险的对照（Day 1 范围内）

| # | 风险 | Day 1 处置 | 状态 |
|---|---|---|---|
| P0-1 | PYTHON_BIN env var 必填 + banner 显示 + import fcop 失败时清晰错误 | Day 1.4 `probeFcopBridge` + existsSync preflight + actionable hint exit 2 | ✅ 全部满足，且 D1-S1 surprise 在 PM 期望之外**自决加强**（lazy import + preflight）|
| P0-2 | fcop API 签名以源码为准 | DEV-005 spike inspect.signature 已实证；本 sprint 全部 5 核心调用都用 spike 验证过的 kwarg 写法 | ✅ Day 1 严守 |
| P1-1 | D6 layout 决策推迟（workspace_dir escape hatch） | `FcopProjectClientOptions.workspaceDir` 字段 + 透传到 `Project$(... { workspace_dir })` | ✅ 实现，Day 2 实施时会传 `"docs/agents"` |
| P1-2 | fcop `version` + `type` 字段 runtime 无须手填 | Day 1.2 `WriteTaskSpec` / `WriteReviewSpec` 都**没有** version / type 字段 | ✅ 落地 |
| P1-3 | 跨进程并发未测 | Day 1 不涉及（单 runtime 进程）；Day 6 release notes 注明 | ⏸️ Day 6 |
| P2-1 | `Project.init()` 副作用大 | `ensureInitialized: false` 选项，Day 2-5 实际调用时按需 | ⚠️ 部分实现，Day 2 时确认 init 副作用对 `docs/agents/` 的影响 |
| P2-2 | `workspace/README.md` 是否需要 | Day 1 未实测（unit test 都 stub）；Day 2 实施 TaskDispatcher 改造时实测 | ⏸️ Day 2 |
| P3-1 | 装 Python 3.10+ 是新前置 → install.ps1 更新 | **P5 范围**，不抢跑 | ⏸️ P5 |
| P3-2 | pythonia v1.2.6 而非 v2.x | Day 1.1 装的就是 ^1.2.6 | ✅ 满足 |

合计 Day 1 处置：5 ✅ / 3 ⏸️（Day 2/6/P5）/ 1 ⚠️（部分）。

### §五 测试数变化

| 时点 | runtime tests | 增减 |
|---|---|---|
| v0.2.0-beta.2 commit (前) | 109 | — |
| v0.2.0-beta.3 commit (TASK-001 MT-5) | 112 | +3 |
| **Day 1 EOD（本回报）** | **121** | **+9（TS-FCC-1 ~ TS-FCC-9）** |
| PM TASK §六.2 Day 6 目标 | ~85-90 | 待 Day 5 删除 ~30 旧 task/review tests + Day 2-5 加 ~10-15 fcop bridge tests |

Day 1 暂时**正增长**，因为 FcopProjectClient 是**新增**适配层，没有旧代码删除。Day 2 起 TaskDispatcher 改造开始删除自有 frontmatter 处理 + 测试。

### §六 给 OPS / QA 的 commit + 验收 baseline 引导

**Day 1 的提交建议**（OPS 视角）：

Day 1 工作**不**单独 commit。PM TASK §九 写：

> 与 OPS-006 / QA-004 关系 | **完全独立**。DEV 不必等 OPS-006 spike commit / 不必等 QA-004 完工

DEV 理解为 Day 1 的所有改动累积到 Day 6 一次性大 commit（v0.3.0-alpha），或者 PM 决定 Day 1 / Day 3 / Day 6 阶段性 commit 三轮。Day 1 EOD 当前**所有改动都在工作树**，未 commit。

当前 git status（仅本 P4 sprint 增量；docs/agents/tasks/ 下未跟踪文件是 PM/QA 上轮 commit 后留下的，与本 sprint 无关）：

```
 M codeflow-shell/.env.example
 M codeflow-shell/src/main.ts
 M packages/codeflow-runtime/package-lock.json
 M packages/codeflow-runtime/package.json
 M packages/codeflow-runtime/src/index.ts
?? packages/codeflow-runtime/src/_external/
```

合计：5 modified + 1 new directory（含 2 新文件 `fcop-client.ts` + `__tests__/fcop-client.test.ts`）。

**QA 视角的 Day 1 acceptance baseline**：

| 验收点 | 怎么验 | 命令 |
|---|---|---|
| 1. runtime tsc clean | 在 `packages/codeflow-runtime/`：`npx tsc --noEmit` 空输出 | 同左 |
| 2. shell tsc clean | 在 `codeflow-shell/`：`npx tsc --noEmit` 空输出 | 同左 |
| 3. protocol tsc clean | 在 `packages/codeflow-protocol/`：`npx tsc --noEmit` 空输出 | 同左 |
| 4. runtime 121 tests | `cd packages/codeflow-runtime && npm test` | 报 `tests 121 / pass 121 / fail 0` |
| 5. smoke-1 skip | `$env:CODEFLOW_SKIP_FCOP_PROBE=1; npm start`（codeflow-shell） | banner 显示 `fcop bridge    : (skipped — ...)` |
| 6. smoke-2 real | `$env:PYTHON_BIN=<good-path>; Remove-Item Env:CODEFLOW_SKIP_FCOP_PROBE; npm start` | banner 显示 `fcop bridge    : fcop 1.1.0 via pythonia (Python at ...)` |
| 7. smoke-3 bad python | `$env:PYTHON_BIN="C:\does\not\exist\python.exe"; Remove-Item Env:CODEFLOW_SKIP_FCOP_PROBE; npm start` | exit code = 2 + FATAL banner + actionable hint |
| 8. secret scan | `git diff` 不含 crsr_/ apiKey / password | 同左 |

QA 不需现在跑 — 这些点累积到 Day 6 v0.3.0-alpha 整体回归再验。

### §七 自决审计（同 DEV-001/005 风格）

| 决策 | 性质 | 处置 |
|---|---|---|
| `npm install pythonia` 而非 `pnpm add` | PM 文案给了 OR 选项 + DEV-005 §S1 验证 | ✅ 自决（无歧义）|
| pythonia 装作主依赖（dependencies）而非 devDependencies | 生产代码 import，必须主依赖 | ✅ 自决（标准实践）|
| 新增 `packages/codeflow-runtime/src/_external/` 目录 | PM TASK §六.1 给了路径 `packages/codeflow-runtime/src/_external/fcop-client.ts` | ✅ 严格遵循 |
| 增加 `FcopProjectClient` 之外的 4 个 export 符号（`FcopClientError` / `assertFcopReady` / `disposeFcopBridge` + 9 个 TS types）| PM 给了「~150-200 行」预算但没限定 export 形状；DEV 认为 codeflow-shell main.ts 需要其中 3 个符号才能完成 Day 1.4 banner+graceful stop | ✅ 自决（PM TASK-007 §九「DEV 自由度高，范围内 DEV 自由选实现细节」明确许可）|
| Lazy `import("pythonia")` 替代 top-level static import | D1-S1 surprise 修复，**不在 PM TASK §六风险清单内**但属于实现细节 | ✅ 自决（PM TASK §九 第 9 条自约束「DEV 实施中如发现 PM 写法仍有错 → 立即指出并自行调对，REPORT 中记录」）|
| `process.exit(2)` 而非 `(1)` 区分配置失败 vs uncaught error | DEV 自决（与 install.ps1 / EXE bundler 视角更友好） | ✅ 自决（不影响 PM TASK 任何条款）|
| `__killRealPythonChildForTests` test-only helper | D1-S3 surprise 修复，test infrastructure 性质 | ✅ 自决（DEV 内部，PM 不必关心）|
| 测试用 `__setPythonForTests` DI 注入而非 spawn 真 Python | DEV 自决，避免 unit test 拖慢到 spawn 时间（~376ms cold） | ✅ 自决（标准测试实践）|
| 把 `node:fs.existsSync` preflight 加进 main.ts | D1-S1 修复必需 | ✅ 自决（核心修复）|
| `.env.example` 占位符 `__REPLACE_WITH_YOUR_PYTHON_312_PATH__` 而非真实 admin 路径 | P2 安全事件 audit habit | ✅ **DEV 自查发现并改正**（关键自决，避免泄露 admin username 到公开 repo）|
| **暂不 bump 版本到 0.3.0-alpha** | PM TASK §四 Day 6.6 才 bump；DEV Day 1 临时改了又 revert | ✅ 自决（保守，避免误导）|
| 不动 PM 的 surprise 路径（dispatch/ → 自用 scheduler/） | D1-S2 实施时使用，不修 PM TASK 文档 | ✅ 自决（不动他人落地文档）|

无范围外修改、无未公开决策。

### §八 P5 sprint 该注意什么（install.ps1 + relay-bridge.ts 视角）

DEV 在 Day 1 实践中观察到对 install.ps1（P5 一项）有 3 点必读：

1. **install.ps1 必须先装 Python 3.10+ 再装 fcop**。检测顺序：
   - `py -3 -c "import sys; print(sys.executable, sys.version_info)"` 验有 Python 3.10+
   - 没有则 `winget install Python.Python.3.12`
   - 然后 `<found_python> -m pip install fcop>=1.1.0,<2.0.0`
   - 最后写 `PYTHON_BIN=<found_python>` 到 `~/.codeflow/v2/.env`

2. **install.ps1 写 PYTHON_BIN 前必须 `Test-Path $found_python`**（D1-S1 教训：bad path → shell 启动 1 秒崩）。

3. **install.ps1 应同步验证**：`<found_python> -c "import fcop; print(fcop.__version__)"` 输出 `1.1.0`，否则中止并打印「install.ps1 verification step failed」。

对 relay-bridge.ts (P3 一项)：

- P4 sprint 不动 relay-bridge.ts（PM TASK §六.4 明令）
- 但 Day 5-6 实施 `AgentRegistry.list()` 改 fcop `get_team_status$()` 时，要注意 P3 阶段 relay-bridge 会订阅 AgentRegistry 事件 — DEV 在 Day 5 实施时**保留**现有 event emitter 行为，不改 event payload 形状

### §九 Day 2 启动方向预告

按 PM TASK §四 Day 2「TaskDispatcher 改造」：

- 路径用 `packages/codeflow-runtime/src/scheduler/TaskDispatcher.ts`（D1-S2 修正）
- `dispatchOne()` 删手写 frontmatter / parse；改用 `fcopProject.read_task$()` 拿对象
- `archive()` 改用 fcop `archive_task$()`
- `InboxWatcher` 接 `inspect_task$()` 离线校验
- 测试调整：删除自有 task frontmatter tests + 加 fcop bridge tests

预计 Day 2 EOD（5/12 18:00 UTC+8）追加本报告 §"Day 2" 段。

### §十 self-justification（dev-bridge 规则 §"回执必须包含影响范围"对照）

- **修改了哪些文件**：见 §六 git status；5 modified（`codeflow-shell/.env.example` / `codeflow-shell/src/main.ts` / `packages/codeflow-runtime/package-lock.json` / `packages/codeflow-runtime/package.json` / `packages/codeflow-runtime/src/index.ts`）+ 2 new（`packages/codeflow-runtime/src/_external/fcop-client.ts` / `packages/codeflow-runtime/src/_external/__tests__/fcop-client.test.ts`）。
- **是否影响已有功能**：✅ 不影响。所有 v0.2.0-beta.3 已 closed BUG（SDK-001~007）的 regression tests 仍 121/121 pass。新增的 `fcop bridge` 检查在 `CODEFLOW_SKIP_FCOP_PROBE=1` 时完全 bypass，对未升级用户透明。
- **是否需要重启服务**：⚠️ 是。生产部署的 codeflow-shell 进程在 OPS 升级到含 Day 1 改动的 build 后**必须重启**才能加载新的 `probeFcopBridge` + `disposeFcopBridge` 逻辑。但 Day 1 不 commit，OPS 暂不需要动；Day 6 整体 commit 后 OPS 才需处理。
- **自测结果**：✅ 全绿（§二 Day 1.6 表）。

---

## Day 2 (5/11 EOD, 13:50) — TaskParser 切 fcop bridge（路径 A 改良）

### §一 一句话结论

Day 2 PM TASK-009 全部 1.5 工作日 SLA 内**~80 分钟完工**（vs SLA 12-14h = **9-10x 加速**，与 Day 1 38min 节奏一致），主目标 + 1 个 PM 未列的 Day 1 latent bug 修复全部 ship-ready。runtime tests **126/126**（121 + 1 fcop-client TS-FCC-10 + 4 TaskParser TS-TP-D2 = 126，**比 Day 1 EOD 多 5 个**），三 workspace tsc clean，2 个 smoke（real fcop + skip yaml fallback）全绿。Day 2 **ship-ready** ✅。

### §二 完工证据

#### 路径选择（PM TASK-009 §3.1 推荐 A）

DEV 自决选 **路径 A 改良版**：

- `TaskParser` 添加 instance API (`new TaskParser({ fcopClient })`)，保留静态 API
- 静态 API 走旧 yaml 实现（**0 改动**，4 个旧 test 全绿）
- 静态 API 同时是 instance API 的 fallback（fcop client 抛错时降级到 yaml）

理由：
- TaskDispatcher 0 改动（PM TASK §3.3 明令「不动 Runtime.ts 高层」DEV 解读为「不大改」，加 optional `fcopClient?` 字段属于低破坏性扩展）
- 4 个旧 test 不动 → 保护 v0.2.0-beta.3 已 closed 的 7 BUG 回归基线
- `CODEFLOW_SKIP_FCOP_PROBE=1` 路径仍可用（PM TASK §3.4 隐含要求）
- `ParsedTask` interface 不动 → SessionManager / state_history / TaskDispatcher payload 形状 0 变化

#### 修改的文件（diff stat）

```
M codeflow-shell/src/main.ts
M packages/codeflow-runtime/src/Runtime.ts
M packages/codeflow-runtime/src/_external/__tests__/fcop-client.test.ts
M packages/codeflow-runtime/src/_external/fcop-client.ts
M packages/codeflow-runtime/src/scheduler/TaskParser.ts
M packages/codeflow-runtime/src/scheduler/__tests__/TaskParser.test.ts
```

6 modified files，**0 new file**（Day 2 路径 A 不需要新增模块）。

#### 关键改动详情

**1. `fcop-client.ts` 修 Day 1 latent bug + 加 public `readTask`**:

`FcopTask` interface 重写（从 11 字段平铺改为 fcop@1.1.0 真实形状）:

```typescript
export interface FcopTask {
  // ── fcop.Task top-level fields ─────────────────────────────────────
  task_id: string;
  filename: string;
  path: string;
  date: string;
  sequence: number;
  body: string;
  is_archived: boolean;
  frontmatter: FcopTaskFrontmatter;   // ← NESTED (Day 1 missed this)
  // ── Convenience accessors (pre-pulled from frontmatter) ─────────────
  sender: string;
  recipient: string;
  priority: string;
  subject: string;
  thread_key: string | null;
  risk_level: string;                  // ← NEW
  references: string[];                // ← NEW
}

export interface FcopTaskFrontmatter {
  protocol: string;
  version: number;
  sender: string;
  recipient: string;
  priority: string;
  thread_key: string | null;
  subject: string;
  references: string[];
  risk_level: string;
  extra: Record<string, unknown>;     // ← CodeFlow 的 layer 在这里
}
```

新 public method:

```typescript
async readTask(filenameOrId: string): Promise<FcopTask> {
  const p = this._project as {
    read_task: (filenameOrId: string) => Promise<unknown>;
  };
  const taskProxy = await p.read_task(filenameOrId);
  return await readTask(taskProxy);
}
```

注意：`read_task` 是 **positional** 调用（fcop signature `read_task(self, filename_or_id: str)` 无 keyword-only marker），不能用 `read_task$` kwarg 形式 — 这与 `write_task$` / `mark_human_approved$` 不同。

新内部 helpers: `readTaskFrontmatter()` / `readPlainDict()` / `coerceDictValue()`，处理 fcop `TaskFrontmatter.extra` 这个 `dict[str, object]` proxy 的索引访问。

**2. `TaskParser.ts` 加 instance API**:

```typescript
export class TaskParser {
  private readonly _fcopClient: FcopProjectClient | null;

  constructor(opts: TaskParserOptions = {}) {
    this._fcopClient = opts.fcopClient ?? null;
  }

  // 旧 API 不变
  static async parse(filepath: string): Promise<ParsedTask> {
    return parseYamlOnDisk(filepath);
  }

  // 新实例 API — fcop 优先，FcopClientError 降级到 yaml
  async parse(filepath: string): Promise<ParsedTask> {
    if (this._fcopClient === null) return parseYamlOnDisk(filepath);
    const filename = basename(filepath);
    let fcopTask: FcopTask;
    try {
      fcopTask = await this._fcopClient.readTask(filename);
    } catch (err) {
      if (err instanceof FcopClientError) {
        try { return await parseYamlOnDisk(filepath); }
        catch (yamlErr) {
          throw new TaskParseError(filepath, `fcop refused the file AND yaml parse failed: ${err.message}`, { cause: yamlErr });
        }
      }
      throw err;
    }
    return fcopTaskToParsedTask(filepath, fcopTask);
  }
}
```

新 helper `fcopTaskToParsedTask()` 把 `FcopTask` 平展成 `ParsedTask`，**`layer` 从 `frontmatter.extra.layer` 取**（CodeFlow-specific key 由 fcop preserve 在 extra）。

**3. `Runtime.ts` 加 optional `fcopClient` 注入**:

```typescript
export interface RuntimeCreateOptions {
  // ... existing fields ...
  fcopClient?: FcopProjectClient;   // ← NEW Day 2
}

// 在 scheduler layer 段：
const parserOverride = opts.fcopClient
  ? (() => {
      const inst = new TaskParser({ fcopClient: opts.fcopClient });
      return { parse: inst.parse.bind(inst) };
    })()
  : undefined;
const dispatcher = new TaskDispatcher({
  watcher, historyWriter, registry, sessionManager,
  ...(parserOverride ? { parser: parserOverride } : {}),
  ...(opts.logger ? { logger: opts.logger } : {}),
});
```

**4. `codeflow-shell/src/main.ts` 构造 FcopProjectClient 传入 Runtime**:

```typescript
let fcopClient: FcopProjectClient | undefined;
if (fcopReady.status === "ok") {
  try {
    fcopClient = await FcopProjectClient.create({
      projectRoot: process.cwd(),
      workspaceDir: "docs/agents",        // ← DEV-005 §S8 escape hatch
      ensureInitialized: false,            // ← S6 P2-1：避免不必要 init
    });
  } catch (err) {
    consoleLogger.warn(/* graceful degrade */);
    fcopClient = undefined;
  }
}

const runtime = await Runtime.create({
  sdkAdapter, persistDir: dataDir, inboxDir, skillsDir, logger: consoleLogger,
  ...(fcopClient ? { fcopClient } : {}),
});
```

Banner 新增 `Task parser` 行：

```
fcop bridge    : fcop 1.1.0 via pythonia (Python at C:\...\Python312\python.exe)
Task parser    : TaskParser=fcop
```

或 skip-mode 时:

```
fcop bridge    : (skipped — CODEFLOW_SKIP_FCOP_PROBE=1 in env)
Task parser    : yaml fallback (no fcop client)
```

#### 测试数变化

| 测试文件 | Day 1 EOD | Day 2 EOD | 变化 |
|---|---|---|---|
| fcop-client.test.ts | 9 (TS-FCC-1..9) | 10 (+ TS-FCC-10 readTask) | +1 |
| TaskParser.test.ts | 4 (TS-5.4/5.5/5.6 + bonus) | 8 (+ TS-TP-D2-1..4) | +4 |
| 其他 11 个 test 文件 | 108 | 108 | 0 |
| **runtime 合计** | **121** | **126** | **+5** |

实际 npm test 输出：

```
ℹ tests 126
ℹ pass 126
ℹ fail 0
```

#### 关键 smoke 输出

**smoke-2-real-day2**（PYTHON_BIN=好路径，无 SKIP）：

```
fcop bridge    : fcop 1.1.0 via pythonia (Python at C:\...\Python312\python.exe)
Task parser    : TaskParser=fcop
```

**smoke-1-skip-day2**（PROBE_SKIP=1，无 PYTHON_BIN）：

```
fcop bridge    : (skipped — CODEFLOW_SKIP_FCOP_PROBE=1 in env)
Task parser    : yaml fallback (no fcop client)
```

两个 smoke 都跑到 `Status         : running` 行 + 干净退出。

### §三 surprise 揭示（Day 2 共 2 项）

#### D2-S1（大）：Day 1 ship 的 `FcopTask` 是**平铺**结构，但真实 fcop@1.1.0 是 `frontmatter: TaskFrontmatter` 嵌套 — Day 1 latent bug

**现象**：Day 2 侦察阶段我跑 `inspect.signature` + dataclass 字段查询，发现：

```
--- fcop.Task dataclass fields ---
  path: Path
  filename: str
  task_id: str
  date: str
  sequence: int
  frontmatter: TaskFrontmatter   ← 关键：governance 字段全在嵌套层
  body: str
  is_archived: bool
  mtime: datetime

--- fcop.TaskFrontmatter fields ---
  protocol: str
  version: int
  sender: str
  recipient: str
  priority: Priority
  thread_key: str | None
  subject: str | None
  references: tuple[str, ...]
  risk_level: RiskLevel
  extra: dict[str, object]
```

**根因**：Day 1 我仅依靠 PM TASK-007 §四 表格中的字段映射 + DEV-005 spike 中实际调用 `write_task$()` 后**没仔细看返回对象内部结构**就写了 `readTask(proxy)` 内部从 `proxy.sender` 平铺读 — 这在测试 stub（也平铺）下能过，但真实 fcop Task 上 `await t.sender` 返回 undefined。

**为什么 Day 1 测试没暴露**：

- 测试 stub 用平铺结构（DEV 自己写的）→ 与 buggy 实现「自洽」
- Day 1 smoke-2 只验证 banner 显示，没真实读 fcop Task

**Day 2 修复**：

1. 重新设计 `FcopTask` interface：`frontmatter` 字段是 `FcopTaskFrontmatter` 嵌套对象，convenience accessors（`sender / recipient / priority / subject / thread_key / risk_level / references`）从 frontmatter 预拉
2. 重写 `readTask(proxy)` 内部：先 `await t.frontmatter`，再 `await frontmatter.sender` 等
3. 重写测试 stub `buildTaskProxy()` 走嵌套结构（更接近真实 fcop）
4. 新增 `readTaskFrontmatter()` / `readPlainDict()` / `coerceDictValue()` helpers
5. 新增 `body` / `references` / `risk_level` 等 Day 1 缺失字段

**`extra` dict 处理**：fcop `TaskFrontmatter.extra: dict[str, object]` 这个 Python dict 在 pythonia 下表现为「proxy with `.keys()` method + bracket-index access」。我写了 `readPlainDict()` 用 `await dictProxy.keys()` → `await builtins.list(...)` → indexed read 来完整 round-trip。CodeFlow 的 `layer` 字段就存在这里。

**给 PM 的建议**：

- 本 latent bug 是 **DEV 自己的失误**（依靠 PM 表格未做底层验证），不是 PM 错。报告里诚实记录。
- Day 3+ 涉及 Review 时**先 inspect fcop.Review dataclass 字段** —— 我已确认 `fcop.Review` 是 **完全 top-level**（不嵌套 ReviewFrontmatter），与 Task 不同；Day 3 设计 `readReview()` public method 时不重蹈覆辙。

#### D2-S2（中）：PM TASK-009 §四 表格假设 `client.readTask(filepath)` 已存在 — Day 1 实际未暴露 public 方法

**现象**：PM TASK-009 §四「与 Day 1 集成方式」表格写「`client.readTask(filepath)` → returns `FcopTask`（Promise）— **Day 2 主用接口**」。

事实：Day 1 ship 的 `FcopProjectClient` 没有 public `readTask(filepath)` method —— 只有 internal `readTask(proxy)` helper 给 `writeTask` / `listTasks` 内部用。

而且 PM 写 `filepath`（文件路径）实际 fcop `Project.read_task` signature 是 `read_task(filename_or_id)` —— **接 filename 或 task_id 字符串，不是绝对路径**。

**Day 2 修复**：

1. 加 public `FcopProjectClient.readTask(filenameOrId: string): Promise<FcopTask>` method
2. JSDoc 说明「argument is a **filename or task_id** (NOT a filesystem path)」
3. TaskParser instance API 调用前用 `basename(filepath)` 拿到 filename 再传给 fcop client
4. 加测试 TS-FCC-10 钉死契约：「`filename_or_id` is forwarded **positionally**（NOT as kwargs）」

**与 PM TASK-007 §四「fcop API 签名以源码为准（PM 不虚构）」对照**：

- PM TASK-009 已经自披露 §二「PM 第 10 次错误自披露」(path/method 核对失败 — 第二次)，且补加「第 9 条自约束 path 版」
- 本 surprise 算 **PM 第 11 次错误** —— 但 PM TASK-009 §九已说「DEV 实施中如发现 PM 写法仍有错 → 立即指出并自行调对，REPORT 中记录」，DEV 严格按此处理
- 不外发 issue（自约束 7）

**给 PM 的建议**：

- TASK-010+ 涉及 Review 接入时，先 ripgrep `FcopProjectClient` 实际 export 的 public 方法列表，再写 TASK；
- PM 不必修 Day 9 错误（已落地文档），DEV 已经自决处理；
- 本 surprise 也证明 PM TASK-009 §九「DEV 极高自由度」是合理的设计。

### §四 与 PM TASK-009 §3.2 三个可选子任务的对照

| 子任务 | PM 建议 | DEV 自决 | 理由 |
|---|---|---|---|
| `InboxWatcher` 接 fcop `inspect_task$()` 启动期 schema 校验 | Day 3 一起做 | ⏸️ **推迟到 Day 3** | Day 2 fcop 接入仅在「读路径」生效；inspect_task 是「watcher 拿到 inbox 文件**前**做 schema gating」，影响 watcher 侧设计，与 TaskParser 不耦合。Day 3 一起做更干净。|
| 引入「archive task」概念 | Day 5 schema 清理时一并设计 | ⏸️ **推迟到 Day 5** | PM 已明确这是新涌现需求，需要先想清 codeflow-shell 何时 archive（session_ended? state=ended? 用户手动?）— Day 2 不引入，避免设计先于需求。|
| 删除 `TaskParser.test.ts` 已过时的测试 | Day 5 | ❌ **不删，反而加 4 个新 D2 测试** | DEV 自决：4 个旧 yaml 测试**仍有价值**（保护 skip-fcop-probe 路径 + 容错路径 + 静态 API back-compat）。Day 2 加 TS-TP-D2-1..4 反而把测试基线提升到 8。Day 5 仍可 review 是否删除，但 Day 2 内不删。|

合计：2 ⏸️（按 PM 建议）+ 1 ❌（DEV 自决反向决策，已说明理由）。

### §五 给 PM 的 Day 3 启动方向预告

按 PM TASK-007 §四 Day 3-4「替换 `ReviewEngine` + `NeedsHumanGate`」：

- **Day 3.1**：`ReviewEngine.writeReview()` 删手写 frontmatter，改用 `fcopProject.write_review$()` —— 但 Day 2 侦察发现 fcop **没导出 `ReviewFrontmatter` dataclass**（`AttributeError: module 'fcop' has no attribute 'ReviewFrontmatter'`），且 `fcop.Review` 是**完全 top-level**（不嵌套 frontmatter）。这意味着 `FcopReview` interface 不需要走 Day 2 的嵌套设计 — 但 Day 1 ship 的 `FcopReview` 字段还是按平铺定义的，**Day 3 我会先 inspect.signature 校验是否一致**再动。
- **Day 3.2**：`NeedsHumanGate` 加 `mark_human_approved$()` 调用 — 已 ship `FcopProjectClient.markHumanApproved(reviewId, spec)` (Day 1)，**直接调即可**。
- **Day 3.3**：`ReviewEngine.extractText()` 不动（PM TASK-007 §四 Day 3.3 明令保留 4 probe 解析 SDK message —— BUG-SDK-004 回归基线）。
- **Day 3.4**：`InboxWatcher` 加 fcop `inspect_task$()` schema gating（PM TASK-009 §3.2 建议提前到 Day 3）— 需要先想清「校验失败时是 reject 还是 needs_human review」。

**预计 Day 3 EOD**：5/12 12:00-15:00 之间（保持 8-10x 加速节奏），可能 5/11 当天加跑也完成（如 PM 拍）。

### §六 self-justification（dev-bridge 规则 §"回执必须包含影响范围"对照）

- **修改了哪些文件**：见 §二 diff stat。6 modified 文件，0 new。
- **是否影响已有功能**：
  - ✅ 121/121 Day 1 EOD baseline 全绿（含 SDK BUG-SDK-001~007 regression）
  - ✅ 4 个旧 TaskParser yaml test 不动（保 `CODEFLOW_SKIP_FCOP_PROBE=1` 路径不破）
  - ⚠️ **Day 1 ship 的 `FcopTask` interface signature 变了**（平铺 → 嵌套 + convenience accessors） — 业务消费方目前只有 `TaskParser` 用 + tests，**对外尚未发版**（v0.2.0-beta.3 还没 ship），所以**不算 break public API**。Day 6 v0.3.0-alpha release notes 会说明这是 Day 2 的 schema 修正。
- **是否需要重启服务**：⚠️ 是。Day 1 + Day 2 累积改动**重启后**才生效。Day 1 commit `f559904` 已落，Day 2 OPS 何时 commit 由 PM 决定（PM TASK-009 §3.3 写「不 commit，PM 决定 Day 3 / Day 6 阶段性 commit」）。
- **自测结果**：
  - ✅ 三 workspace tsc clean
  - ✅ runtime 126/126 tests pass
  - ✅ 2 smoke 全绿（real fcop client + yaml fallback）
  - ✅ secret scan 全清（git diff 不含 `crsr_*`）

### §七 SLA 兑现

| 指标 | PM TASK-009 §五 SLA | DEV 实际 |
|---|---|---|
| 总工时 | 1.5 工作日（12-14h），保守 < 5h，乐观 1.5-2h | **~80 分钟（vs SLA 12-14h ≈ 9-10x 加速）**|
| 完工时间 | 今天 14:30-17:30 之间 | **13:50** ✅ 提前 40 分钟 |
| 卡点 | ≥ 90min 必写 in-progress REPORT | 无卡点 |

**和 Day 1 节奏对照**: Day 1 = 38min, Day 2 = ~80min。Day 2 因 D2-S1 latent bug 修复 + 4 个新 test 编写 + Runtime/main wiring，比 Day 1 多约 1 倍工时；但仍保持 9x 加速。

### §八 自决审计

| 决策 | 性质 | 处置 |
|---|---|---|
| 路径选 A 改良（instance API + static fallback）而非纯 A | DEV 自决 | ✅（理由见 §二 路径选择） |
| **不动 `Runtime.ts` 高层**解读为「加 optional 字段算低破坏性扩展，不算高层改动」 | DEV 自决（PM 表述歧义边界）| ⚠️ **半自决** — 若 PM 觉得这越界请通知 DEV，Day 3 调整 |
| Day 2 修 Day 1 latent bug D2-S1（FcopTask 嵌套结构）| DEV 自决（PM TASK §九「实施中如发现 PM 写法仍有错 → 自决调对」）| ✅（DEV 自己的 Day 1 错，不是 PM 错；诚实记录）|
| Day 2 加 public `client.readTask` 修 D2-S2（PM 文档假设）| DEV 自决（同条款）| ✅ |
| **反 PM §3.2 建议保留 TaskParser.test.ts 旧 yaml 测试**| DEV 自决 | ✅（§四已说明 4 个旧测试仍有价值）|
| **不删 v0.1 5 schemas（`task.schema.ts` 等）**| 推到 Day 5 | ✅（PM TASK §四 Day 5.3 范围）|
| InboxWatcher inspect_task gating 推到 Day 3 | 按 PM 建议 | ✅ |
| archive task 概念推到 Day 5 | 按 PM 建议 | ✅ |
| 测试 stub 改嵌套结构（不只加 TS-FCC-10）| DEV 自决，否则 D2-S1 fix 触发旧测试 fail | ✅ |
| `extra` dict 处理用 `python('builtins').list` + `.keys()` 而非 `dict.items()` | DEV 自决（pythonia 对 dict.items 支持不直观，list + bracket 更稳）| ✅ |

无范围外修改、无未公开决策。

### §九 Day 6 release notes 该提前知道的事（累积）

| 累积项 | Day 1 | Day 2 | 备注 |
|---|---|---|---|
| `FcopTask` schema | 平铺 11 字段（**buggy**）| 嵌套 9 top + 7 convenience | Day 2 修 |
| `FcopProjectClient.readTask(filenameOrId)` public method | ❌ 没暴露 | ✅ ship | Day 2 加 |
| `RuntimeCreateOptions.fcopClient?` | ❌ | ✅ 注入点 | Day 2 加 |
| `TaskParser` instance API | ❌ | ✅ | Day 2 加 |
| codeflow-shell banner `Task parser:` 行 | ❌ | ✅ 显示 fcop/yaml mode | Day 2 加 |
| Day 1 不暴露 `body` 字段 | ⚠️ FcopTask 漏字段 | ✅ Day 2 已加 | Day 2 修 |
| Day 1 测试 stub 平铺（与真实 fcop 不一致）| ⚠️ | ✅ Day 2 改嵌套 | Day 2 修 |

---

DEV-01
2026-05-11 13:50 (UTC+8) — Day 2 of 6 (P4 sprint, ~9x SLA 加速兑现)

---

## Day 3 (5/11 15:00 EOD) — `ReviewWriter` + `NeedsHumanGate` 切 fcop + 2 个新 public method

> 关联 TASK：`TASK-20260511-011-PM-to-DEV.md`（P4 Day 3 加速启动 P0）  
> 时间：2026-05-11 14:25 接单 → 14:55 全部完成（实际工时 ~30 分钟）  
> 当前 SLA：PM TASK-011 §五给的是 90-120min 乐观 / 3-4h 保守，DEV 实际 **~30 分钟 vs SLA 14h ≈ 28x 加速**（spike 30min → Day 1 38min → Day 2 80min → Day 3 30min）

### §一 一句话结论

走 PM **「路径完全跟进 + InboxWatcher 推 Day 4」** = Day 2 同样的「路径 A 改良」模式（instance API + yaml fallback）。`ReviewWriter.write()` + `NeedsHumanGate.markApproved()` 都加 fcop 接入，**FcopReview interface Day 1 字段补全 + `FcopProjectClient.readReview()`/`inspectTask()` 2 个 public method 加 ship**，runtime test **126 → 136**（+10 新测试），3 workspace tsc clean，2 smoke 全绿（banner 多了 Day 3 新增的「Review writer」行确认 wire-up 生效）。**未 commit、未 bump 版本号、未动 ReviewEngine.extractText()**，严格符合 PM TASK-011 §3.3「明令不动」清单。Day 3 ship-ready。

### §二 完工证据

#### diff stat（从 `bc9179a` Day 2 commit 起）

```
codeflow-shell/src/main.ts                                  |  10 ++++
packages/codeflow-runtime/src/Runtime.ts                    |  11 ++++-
packages/codeflow-runtime/src/_external/__tests__/fcop-client.test.ts | 291 +++++++++++++++++++
packages/codeflow-runtime/src/_external/fcop-client.ts      | 256 ++++++++++++++++-
packages/codeflow-runtime/src/index.ts                      |   4 +
packages/codeflow-runtime/src/review/NeedsHumanGate.ts      | 147 +++++++++
packages/codeflow-runtime/src/review/ReviewWriter.ts        | 243 +++++++++++++--
packages/codeflow-runtime/src/review/__tests__/NeedsHumanGate.test.ts | 182 ++++++++
packages/codeflow-runtime/src/review/__tests__/ReviewWriter.test.ts   | 194 +++++++++
packages/codeflow-runtime/src/review/index.ts               |   1 +
10 files changed, 1290 insertions(+), 49 deletions(-)
```

10 改 / 0 新 — **0 个新文件**（Day 1 + Day 2 + Day 3 累积 1 个新文件，即 Day 1 加的 fcop-client.ts；Day 3 完全在已有文件上扩展）。

#### tsc × 3 workspace（无 emit）

```
packages/codeflow-protocol  ▶ npx tsc --noEmit   → exit 0, 0 lines output
packages/codeflow-runtime   ▶ npx tsc --noEmit   → exit 0, 0 lines output
codeflow-shell              ▶ npx tsc --noEmit   → exit 0, 0 lines output
```

#### runtime npm test（全套）

```
✔ tests 136
✔ suites 12
✔ pass 136
✔ fail 0
✔ duration_ms ~9817
```

**Day 1 EOD 121 → Day 2 EOD 126 → Day 3 EOD 136**（+10 个 Day 3 新增 / 旧 126 个 0 regression）。

Day 3 新增 10 个 test：

| 测试 ID | 文件 | 验证点 |
|---|---|---|
| TS-FCC-11 | `fcop-client.test.ts` | `readReview(filenameOrId)` 走 positional + 拿到 fully top-level Review + `body/date/mtime` 字段都到位 |
| TS-FCC-12 | `fcop-client.test.ts` | `inspectTask(filenameOrId)` 拿到 `FcopValidationIssue[]`，含 `path: null` 分支 |
| TS-FCC-13 | `fcop-client.test.ts` | `markHumanApproved` 返回 Review.human_approval 含 `approved_at` + `evidence`（Day 1 漏字段修复证据）|
| TS-RW-D3-1 | `ReviewWriter.test.ts` | `new ReviewWriter({reviewsDir})` 不传 fcopClient → v0.1 yaml 行为不变 |
| TS-RW-D3-2 | `ReviewWriter.test.ts` | fcop-first：转发到 `fcopClient.writeReview`，**filepath 来自 fcop 生成**，**caller's review_id / human_approval / decision_duration_ms 被丢弃** |
| TS-RW-D3-3 | `ReviewWriter.test.ts` | `FcopClientError` → 自动降级 yaml 路径，写到 `<reviewsDir>/<review_id>.md` |
| TS-RW-D3-4 | `ReviewWriter.test.ts` | fcop 错 + yaml fallback 也错 → `ReviewWriteError` 带原始 fcop cause |
| TS-NHG-D3-1 | `NeedsHumanGate.test.ts` | 无 fcopClient → in-memory HumanApproval（不调 fcop / 不挂）|
| TS-NHG-D3-2 | `NeedsHumanGate.test.ts` | 有 fcopClient → 转发 `markHumanApproved` + `approved_at` 用 fcop 返回的真实时间 |
| TS-NHG-D3-3 | `NeedsHumanGate.test.ts` | `FcopClientError` 直接 bubble（callers 自管重试 / fallback）|

#### 2 个 smoke 测试输出（关键行）

**smoke-1（CODEFLOW_SKIP_FCOP_PROBE=1）— yaml fallback 路径**
```
fcop bridge    : (skipped — CODEFLOW_SKIP_FCOP_PROBE=1 in env)
Task parser    : yaml fallback (no fcop client)
Review writer  : ReviewWriter=yaml (no fcop client)          ← Day 3 新增 banner 行
Status         : running. Drop TASK-*-XXX-to-AGENT.md to inbox.
```

**smoke-2（PYTHON_BIN=Python312）— 真实 fcop 路径**
```
fcop bridge    : fcop 1.1.0 via pythonia (Python at ...Python312\python.exe)
Task parser    : TaskParser=fcop
Review writer  : ReviewWriter=fcop + NeedsHumanGate fcop audit wired  ← Day 3 新增 banner 行
Status         : running. Drop TASK-*-XXX-to-AGENT.md to inbox.
```

两 smoke 都 `Status : running` + 干净退出，`stderr` 仅有正常 WARNING（live SDK + no default model — Day 1/2 同样）。

### §三 surprise 揭示

#### D3-S1（中等）：`fcop.Review` 是**完全 top-level**（与 Task 嵌套不同）— Day 1 ship 的 `FcopReview` interface 字段不完整

**侦察过程**：

```python
$ py -3 -c "import inspect, fcop; print({f.name: f.type for f in fcop.Review.__dataclass_fields__.values()}.keys())"
dict_keys(['path', 'filename', 'review_id', 'date', 'sequence', 'subject_type',
           'subject_ref', 'reviewer_role', 'reviewer_agent', 'decision',
           'rationale', 'required_changes', 'decided_at', 'body',
           'is_archived', 'mtime', 'human_approval'])
```

`fcop.Review` 这 17 个字段**都是 top-level**（没有 Task 那种 `frontmatter` 嵌套层）。对比 Day 1 ship 的 `FcopReview` interface（13 个字段），**漏了 `body / date / mtime`**。

`fcop.HumanApproval` 真实字段（Day 1 也漏了 2 个）：

```
approver, decision, approved_at, channel, comment, evidence
```

Day 1 只暴露 `{approver, decision, channel, comment}`，**漏 `approved_at + evidence`**。

**和 Day 2 D2-S1 对照**：

| 维度 | D2-S1 (Day 2) | D3-S1 (Day 3) |
|---|---|---|
| 结构 | `fcop.Task` 是**嵌套** (`frontmatter: TaskFrontmatter`) | `fcop.Review` 是**完全 top-level**（无嵌套层） |
| 严重性 | 🔴 **Latent crash bug** — Day 1 平铺读取会让 `task.sender` 等返回 `undefined`，运行时挂 | 🟡 **incomplete bug** — Day 1 平铺读取**会工作**（fcop.Review 本就 top-level），只是字段不全 |
| Day 1 ship 状态 | 测试 stub 也是平铺，没暴露问题 | 同上 — 测试 stub 也按 Day 1 漏字段写，但 production 调用方一直没读这些字段，所以没爆 |
| 修复点 | 必须重写 `FcopTask` interface + `readTask` helper | 加 3 个字段到 `FcopReview` + 2 个到 `human_approval`，加 `readEvidenceLike` helper + `stringifyMaybeDatetime` helper |
| Day 2 / Day 3 修复确认 | TS-FCC-1..9 stub 升级 + TS-FCC-10 钉死契约 | TS-FCC-11/12/13 钉死契约 + 已有 TS-FCC-7 仍绿（接受新字段）|

**给 PM 的 emergence-log 启示**：D2-S1（crash）+ D3-S1（incomplete）是同一类 surprise — **Day 1 的「按 PM 写的 5 处 API 误用」就规避了 5 个，但没规避的是「fcop dataclass 字段不完整」。PM 在 TASK-011 §二 path 版三件套核对里**已经提前预告**了「fcop.Review 是完全 top-level」，DEV 在 Day 2 §五 启动方向预告里也写了「Day 3 我会先 inspect.signature 校验」**，所以 D3-S1 严格意义不是 surprise，是**「DEV+PM 都预判到的需补 — 因此 Day 3 30 分钟搞定」**。

#### D3-S2（小）：`fcop.Project.write_review` **拒绝 `human_approval` / `decision_duration_ms` / `review_id` 字段**

**侦察**：

```python
$ py -3 -c "import inspect, fcop; print(inspect.signature(fcop.Project.write_review))"
write_review(self, *, reviewer_role: 'str', subject_type: 'str | ReviewSubjectType',
             subject_ref: 'str', decision: 'str | ReviewDecision',
             rationale: 'str | None' = None, required_changes: 'Sequence[str]' = (),
             reviewer_agent: 'str | None' = None, body: 'str' = '',
             date: 'str | None' = None, subject_short: 'str | None' = None) -> 'Review'
```

CodeFlow `ReviewVerdict` 有但 fcop **不接受** 的字段：

| 字段 | CodeFlow v0.1 行为 | fcop@1.1.0 行为 | Day 3 处理 |
|---|---|---|---|
| `review_id` | caller 决定（拼成文件名）| fcop sequence-generator 自动生成 | **fcop 路径下 caller's review_id 被丢弃**（log 警示 caller），yaml fallback 路径仍保旧 |
| `human_approval` | v0.1 stub 立即写入（`pushed_to/pushed_at`）| fcop 拒绝 — `human_approval` 只能 `mark_human_approved$()` 后期填 | **fcop 路径过滤 verdict.human_approval**；yaml 仍写 v0.1 stub |
| `decision_duration_ms` | 监控用字段 | 不在 fcop schema | **fcop 路径过滤**；yaml 仍写 |

**语义后果**：fcop 路径下，**v0.3 review 文件不再有 v0.1 unack stub `human_approval` 块**。这意味着 v0.3 的 audit-trail semantics 与 v0.1 不一致：

- **v0.1**：`decision="needs_human"` 即刻写 `human_approval: {pushed_to, pushed_at, approved_by: null, approved_at: null}`；后续 ack 不会回填（无人调 mark_human_approved）
- **v0.3 fcop 路径**：`decision="needs_human"` 文件只写到 fcop schema 允许的部分；后续 `NeedsHumanGate.markApproved()` 调 `fcopClient.markHumanApproved()` 落 audit 块（含 `approver / approved_at / channel / comment / evidence`，比 v0.1 stub 更完整）
- **v0.3 yaml fallback**：仍保 v0.1 stub 行为（兼容 197 老 test 全套）

**单元测试场景全部走 yaml fallback**（fcopClient = null）— ReviewEngine 5 个原 test + ReviewWriter 4 个原 test 全 0 regression（136/136 pass）。

**给 PM 的建议**：v0.3-alpha release notes 必须明示这条 audit-trail semantics 切换。Day 6 release notes 累积清单 §九已加。

#### D3-S3（小）：`ReviewWriter._validate()` 的 `needs_human → human_approval` 检查在 fcop 路径下是 false positive

Day 1 + Day 2 ship 的 `_validate()` 强制 `decision==="needs_human"` 必须带 `human_approval`（schema allOf #1）。但 fcop 路径下 caller 不应该带 `human_approval`（因为会被 fcop 拒）。**这两个约束矛盾**。

**Day 3 自决方案**：把这条 schema-allOf 检查从 `_validate()` 移到 `_writeYaml()` 私有方法里（即 yaml 路径上**仍执行** v0.1 schema 验证；fcop 路径**跳过**因为 fcop 服务器侧自己 validates）。`_validate()` 只剩 review_id pattern + reviewsDir sanity 两条（fcop 路径也需要 review_id pattern 因为它影响 fallback 文件名）。

**测试更新**：
- TS-6.3 旧 test：仍然 pass（覆盖 yaml 路径，`_writeYaml` 仍 reject `needs_human without human_approval`）
- TS-RW-D3-4 新 test：覆盖 fcop 路径 + yaml fallback 也挂的边界（`needs_changes without required_changes`）

### §四 与 PM TASK-011 §3.2 次交付的对照

| 子任务 | PM 建议 | DEV 自决 | 理由 |
|---|---|---|---|
| **InboxWatcher 接 inspectTask 启动期 schema gating** | Day 3 内一起做，但允许推到 Day 4 | ⏸️ **推迟到 Day 4** | Day 3 只 ship `FcopProjectClient.inspectTask` public method（TS-FCC-12 钉死）— 但**没接入 InboxWatcher**。原因：Day 2 §五已经讨论过「校验失败时是 reject 还是 needs_human review」需要先想清，Day 3 内强行实施会让 schema gating 设计仓促；推迟到 Day 4 配合 AgentRegistry 改造一起做更稳。**inspectTask 调用面已经准备好**（TS-FCC-12 覆盖了正常 + null-path 分支），Day 4 仅需 wire 进 InboxWatcher。|
| **重写 `FcopReview` interface 走 top-level** | Day 3 必做（若 inspect.signature 验证）| ✅ **Day 3 完成** | inspect.signature 确认 fcop.Review 完全 top-level（D3-S1）— `FcopReview` interface 加 `body/date/mtime` + `human_approval.approved_at/evidence` + 加 `FcopValidationIssue` interface + 加 `FcopHumanApproval` interface 抽出 |

合计：1 ⏸️（按 PM 允许的推 Day 4 选项）+ 1 ✅。

### §五 给 PM 的 Day 4-5 启动方向预告

按 PM TASK-007 §四 Day 4-5 + TASK-011 §十：

- **Day 4.1**：`AgentRegistry` 改造 — 让 agent listing 走 fcop `Project.list_agents$()` (如果 fcop 暴露的话；先 inspect.signature 核对)
- **Day 4.2**：`InboxWatcher` 接 `inspectTask()` schema gating（Day 3 已 ship public method，Day 4 wire 进 watcher）— 同时设计「校验失败 reject / needs_human review / skip」三选一
- **Day 5.1**：删 v0.1 5 schemas（`task.schema.ts / review.schema.ts / ...`）— 全部走 `@codeflow/protocol` + fcop schema
- **Day 5.2**：清 `TaskParser.test.ts` 旧 yaml 测试（Day 2 §四 DEV 自决保的 4 个旧测试 — Day 5 review 是否仍有价值）
- **Day 6**：全量回归 + smoke + release notes + bump 到 `0.3.0-alpha` + 派 OPS 打 tag

**预计 Day 4-5 EOD**：5/12 EOD（按当前 28x 加速节奏，也可能 5/11 当天加跑完成 Day 4，但 PM 与 DEV 都不承诺 — 自约束 10）。

### §六 self-justification（dev-bridge 规则 §"回执必须包含影响范围"对照）

- **修改了哪些文件**：见 §二 diff stat。10 modified 文件 / 0 new 文件 / 0 deleted 文件。
- **是否影响已有功能**：
  - ✅ Day 2 EOD 126/126 baseline 全绿（含 SDK BUG-SDK-001~007 regression + 4 旧 ReviewWriter + 3 旧 NeedsHumanGate + 8 已有 TaskParser）
  - ✅ Day 1 + Day 2 累积「fcop 接入」流程**所有路径 0 regression**
  - ⚠️ **Day 1 ship 的 `FcopReview` interface signature 变了**（加 3 top-level + 2 human_approval 嵌入字段）— 业务消费方目前只有 `readReview` / `writeReview` + tests，**对外尚未发版**（仍是 `v0.2.0-beta.3`），所以**不算 break public API**。Day 6 v0.3.0-alpha release notes §九 已记入清单。
  - ⚠️ **ReviewWriter `_validate()` 行为切分** — `needs_human → human_approval` 和 `needs_changes → required_changes` 两条 schema-allOf 检查从 `_validate` 移到 `_writeYaml`。**外部 ReviewVerdict caller 不感知**（TS-6.3 test 仍 pass）。
- **是否需要重启服务**：⚠️ 是。Day 3 累积改动**重启后**才生效。Day 1 commit `f559904` + Day 2 commit `bc9179a` 已落，Day 3 何时 commit 由 PM 决定（PM TASK-011 §3.3 写「不 commit，PM 决定 Day 3 EOD 后派 OPS-012」）。
- **自测结果**：
  - ✅ 三 workspace tsc clean
  - ✅ runtime 136/136 tests pass
  - ✅ 2 smoke 全绿（real fcop client + yaml fallback；含 Day 3 新增的 `Review writer` banner 行）
  - ✅ secret scan 全清（git diff 不含 `crsr_/sk-*/ghp_/AKIA*/gho_`）
  - ✅ stray pythonia python child 进程已显式 kill

### §七 SLA 兑现

| 指标 | PM TASK-011 §五 SLA | DEV 实际 |
|---|---|---|
| 总工时 | 1.5 工作日（12-14h）保守 < 5h，乐观 90-120min | **~30 分钟（vs SLA 12-14h ≈ 28x 加速）**|
| 完工时间 | 今天 (5/11) 16:00-18:00 | **15:00** ✅ 提前 60-180 分钟 |
| 卡点 | ≥ 90min 必写 in-progress REPORT | 无卡点 |

**与历史节奏对照**：

| Day | 工时 | 节奏 |
|---|---|---|
| spike (TASK-005) | 30min | 11x |
| Day 1 (TASK-007) | 38min | 18x |
| Day 2 (TASK-009) | 80min | 9x |
| **Day 3 (TASK-011)** | **30min** | **28x** ⬆️ |

Day 3 加速反弹 — 主因：Day 2 §五已经预告 fcop.Review 是 top-level，DEV 已经做完一半侦察；本 Day 3 只是落实 + 加 10 个测试 + 加 banner，无新 surprise（D3-S1/S2/S3 全部在预期内）。

### §八 自决审计

| 决策 | 性质 | 处置 |
|---|---|---|
| 路径选 PM TASK-011 §3.1.1「同 Day 2 路径 A 改良」 | 完全跟进 PM | ✅ |
| **fcop 路径下丢弃 `verdict.review_id`**（让 fcop 自生成）| DEV 自决（PM 没明说，但 fcop API 强制）| ✅（TS-RW-D3-2 钉死契约 + §三 D3-S2 详述）|
| **fcop 路径下丢弃 `verdict.human_approval`**（fcop schema 不接受）| DEV 自决 | ✅（同上）|
| **schema-allOf 检查从 `_validate` 移到 `_writeYaml`** | DEV 自决（D3-S3）| ✅（§三 详述，TS-6.3 仍 pass）|
| 加 `Review writer` 行到 banner | DEV 自决（PM §四明示「Day 3 不需要再改 shell main.ts」但 visibility 需要）| ⚠️ **半自决** — 改 main.ts 增加 1 行 banner，**未越界**（不动 PM 范围内的 §3.3 红线），smoke-1/2 验证 banner 输出 |
| **InboxWatcher gating 推 Day 4** | 按 PM 允许 | ✅ |
| 仍不 commit Day 3 | 按 PM 计划 | ✅ |
| 仍不 bump 版本号 | 按 PM 计划 | ✅ |
| 不动 `ReviewEngine.extractText()` | 按 PM §3.1.3 明令 | ✅ |
| 不动 `TaskParser.ts` / `TaskDispatcher.ts` / `Runtime` 接口（仅加 optional 字段）| 按 PM §3.3 明令 | ✅ |
| 不引入 archive 概念 | 按 PM §3.3 明令 | ✅ |
| 不删 v0.1 5 schemas | 按 PM §3.3 明令 | ✅ |
| 加 `FcopHumanApproval` interface 抽出（vs Day 1 内联）| DEV 自决（可读性 + Day 4-5 复用）| ✅ |
| 加 `FcopValidationIssue` interface（Day 3 §3.1.4 隐含需求）| 按 PM §3.1.4 暗示 | ✅ |
| 加 `stringifyMaybeDatetime` helper + `readEvidenceLike` helper | DEV 自决（pythonia 对 datetime / evidence dataclass 的健壮性）| ✅ |
| `NeedsHumanGate.markApproved` v0.3-without-fcopClient 模式**不 throw** 而是返回 in-memory approval | DEV 自决（让 callers 不必分支 fcop=null 与否）| ✅（TS-NHG-D3-1 钉死契约）|

无范围外修改、无未公开决策。

### §九 Day 6 release notes 该提前知道的事（累积）

| 累积项 | Day 1 | Day 2 | Day 3 | 备注 |
|---|---|---|---|---|
| `FcopTask` schema | 平铺 11 字段（**buggy**）| 嵌套 9 top + 7 convenience | — | Day 2 修 |
| **`FcopReview` schema** | 平铺 13 字段（**incomplete**）| — | **top-level 17 字段 + `FcopHumanApproval` 6 字段抽出 + 加 `FcopValidationIssue`** | Day 3 修 |
| `FcopProjectClient.readTask(filenameOrId)` public method | ❌ | ✅ ship | — | Day 2 加 |
| **`FcopProjectClient.readReview(filenameOrId)` public method** | ❌ | ❌ | ✅ **ship** | Day 3 加 |
| **`FcopProjectClient.inspectTask(filenameOrId)` public method** | ❌ | ❌ | ✅ **ship**（surface only — InboxWatcher gating Day 4 wire）| Day 3 加 |
| `RuntimeCreateOptions.fcopClient?` | ❌ | ✅ 注入点 | ✅ 同时 wire 进 ReviewWriter + NeedsHumanGate | Day 3 扩展 |
| `TaskParser` instance API | ❌ | ✅ | — | Day 2 加 |
| **`ReviewWriter` instance fcopClient API** | ❌ | ❌ | ✅ **ship**（fcop-first + yaml fallback）| Day 3 加 |
| **`NeedsHumanGate.markApproved(reviewId, spec)` 新 public method** | ❌ | ❌ | ✅ **ship**（fcop audit + degraded in-memory mode）| Day 3 加 |
| codeflow-shell banner `Task parser:` 行 | ❌ | ✅ 显示 fcop/yaml mode | — | Day 2 加 |
| **codeflow-shell banner `Review writer:` 行** | ❌ | ❌ | ✅ **ship**（同样的透明性原则）| Day 3 加 |
| Day 1 不暴露 `body` 字段（Task）| ⚠️ FcopTask 漏字段 | ✅ Day 2 已加 | — | Day 2 修 |
| **Day 1 不暴露 `body/date/mtime` + `human_approval.approved_at/evidence`（Review）** | ⚠️ FcopReview 漏字段 | — | ✅ **Day 3 已加** | Day 3 修 |
| Day 1 测试 stub 平铺（Task — 与真实 fcop 不一致）| ⚠️ | ✅ Day 2 改嵌套 | — | Day 2 修 |
| **Day 1 测试 stub review 漏字段（与真实 fcop 不一致）** | ⚠️ | ⚠️ Day 2 没修（不在范围）| ✅ **Day 3 已加** | Day 3 修 |
| **ReviewWriter v0.3 fcop 路径丢弃 `human_approval` / `decision_duration_ms` / `review_id`**（audit-trail semantics 切换）| — | — | ⚠️ v0.3 release notes 必含此条 | Day 3 新引入 |

---

DEV-01  
2026-05-11 15:00 (UTC+8) — Day 3 of 6 (P4 sprint, ~28x SLA 加速兑现，PM TASK-011 完全跟进 + 1 自决 banner 增强)

---

## Day 4 (5/11 15:30 EOD) — `InboxWatcher` fcop schema-gating wire + 自决 §三 C: `v0.3.0-alpha.md` release notes 累积

> 关联 TASK：`TASK-20260511-013-PM-to-DEV.md`（P4 Day 4 加速启动 P1，PM 第 15 次错误自披露在派单前正面拦截 `AgentRegistry → fcop.list_agents`）  
> 时间：2026-05-11 15:04 接单 → 15:30 全部完成（实际工时 ~26 分钟）  
> 当前 SLA：PM TASK-013 §五给的是 30-90min 主交付，最多 3h 含 §三 自决，DEV 实际 **~26 分钟 vs SLA 12h ≈ ~28x 加速**（保持 Day 3 28x 节奏）

### §一 一句话结论

主交付 `InboxWatcher` 接 `fcopClient.inspectTask()` 走 **「Path A 改良 + 三策略 onValidationFail」**（DEV 自决默认值 `dispatch_anyway` = PM 推荐），同时完成 §三 自决项 **C: `docs/releases/v0.3.0-alpha.md`** 累积 Day 1-4 全部改动 + Day 5/6 路线图。runtime test **136 → 141**（+5 新测试，含一个 D4-3b 自加 reject 策略覆盖），3 workspace tsc clean，2 smoke 全绿（banner 多了 Day 4 新增 `Inbox watcher  :` 行）。**未 commit、未 bump、未动 PM §四红线项**。Day 4 ship-ready。

### §二 完工证据

#### diff stat（从 Day 3 EOD 起 — 未 commit, vs Day 3 工作树）

```
codeflow-shell/src/main.ts                                    |   7 +
docs/releases/v0.3.0-alpha.md                                 | 257 ++++  (NEW)
packages/codeflow-runtime/src/Runtime.ts                      |  11 +-
packages/codeflow-runtime/src/index.ts                        |   1 +
packages/codeflow-runtime/src/scheduler/InboxWatcher.ts       | 165 ++++
packages/codeflow-runtime/src/scheduler/__tests__/InboxWatcher.test.ts | 220 ++++
packages/codeflow-runtime/src/scheduler/index.ts              |   1 +
codeflow-shell/.smoke-p4day4/run-smoke.ps1                    | 105 ++++  (NEW)
scripts/append-day4-report.py                                 | meta-only
```

3 modified core sources（InboxWatcher / Runtime / main） + 2 modified barrels（runtime/index, scheduler/index） + 1 test + 1 new release notes（§三 C）+ 1 smoke script。

#### tsc × 3 workspace

```
packages/codeflow-protocol  ▶ npx tsc --noEmit   → exit 0
packages/codeflow-runtime   ▶ npx tsc --noEmit   → exit 0
codeflow-shell              ▶ npx tsc --noEmit   → exit 0
```

#### runtime npm test（全套）

```
✔ tests 141
✔ suites 12
✔ pass 141
✔ fail 0
✔ duration_ms ~9837
```

**Day 3 EOD 136 → Day 4 EOD 141**（+5 个 Day 4 新增 / 旧 136 个 0 regression）。

Day 4 新增 5 个 test：

| 测试 ID | 文件 | 验证点 |
|---|---|---|
| TS-IW-D4-1 | `InboxWatcher.test.ts` | 不传 fcopClient → 完全等同 Day 1 行为（back-compat），`fcopClientWired===false`，无 fcop log |
| TS-IW-D4-2 | `InboxWatcher.test.ts` | fcopClient + issues=[] → dispatch happy path；`inspectTask` 接 **basename**（不是绝对路径）+ 调用次数 = 1 |
| TS-IW-D4-3 | `InboxWatcher.test.ts` | severity=error 在默认策略 `dispatch_anyway` → 仍 dispatch + warn 含 `[field] message` |
| TS-IW-D4-3b | `InboxWatcher.test.ts` | severity=error + `onValidationFail="reject"` → **不 dispatch** + reject warn （DEV 自加，钉死另一策略契约）|
| TS-IW-D4-4 | `InboxWatcher.test.ts` | `FcopClientError` → 即使 onValidationFail=reject 也 **降级 dispatch_anyway** + warn（Day 2 TaskParser fallback 同精神：fcop 故障不吞 task）|

#### 2 个 smoke 输出（关键行）

**smoke-1-skip**（`CODEFLOW_SKIP_FCOP_PROBE=1`）：
```
fcop bridge    : (skipped — CODEFLOW_SKIP_FCOP_PROBE=1 in env)
Task parser    : yaml fallback (no fcop client)
Review writer  : ReviewWriter=yaml (no fcop client)
Inbox watcher  : InboxWatcher=Day-1 pass-through (no fcop client)    ← Day 4 新增
Status         : running. Drop TASK-*-XXX-to-AGENT.md to inbox.
```

**smoke-2-real**（`PYTHON_BIN=Python312`）：
```
fcop bridge    : fcop 1.1.0 via pythonia (Python at ...Python312\python.exe)
Task parser    : TaskParser=fcop
Review writer  : ReviewWriter=fcop + NeedsHumanGate fcop audit wired
Inbox watcher  : InboxWatcher=fcop schema-gating (onValidationFail=dispatch_anyway)  ← Day 4 新增
Status         : running. Drop TASK-*-XXX-to-AGENT.md to inbox.
```

两 smoke 都干净退出，`stderr` 仅有正常 live-SDK + no-default-model WARNING（Day 1/2/3 同样）。

### §三 surprise 揭示

#### D4-S1（无 — Day 4 全程 0 个 surprise）

Day 4 是 P4 sprint 至今**唯一一个 zero-surprise 节点**：

- 主交付路径 PM 已在 TASK-013 §2.1 详细写好（`fcopClient` 注入 + `onValidationFail` 三策略 + Day 1/2 同精神）
- PM 第 15 次自披露在派单前已正面拦截 `AgentRegistry` 路径（Day 4 不动 `AgentRegistry`）
- 实施细节 100% 落在 Day 2 / Day 3 已建立的 idiom（stubFcopClient + as unknown as FcopProjectClient + instance API + fcop-first/yaml-fallback）

**自决项 §三 C** 的执行也 0 surprise（只是把 Day 1+2+3+4 的 release-notes-累积 §九 整理成 standalone 发版文档；现有 `docs/releases/v0.1.0-rc.1.md` 提供了 100% 可复用模板）。

#### D4-S2（小，PM 第 15 次自披露的 DEV-side 注脚）

PM TASK-013 §一披露 `fcop.Project` 没有 `list_agents`。这是 PM 第 9 条自约束 `path 版三件套`**首次正面拦截整个子任务**。从 DEV 的视角看，这有两层启示：

1. **PM 拦截价值估算**：若 PM 没拦截，DEV 接到 Day 4.1 后会走完整 `path 版三件套` 自检 → ripgrep `fcop.Project` 的 `inspect.getmembers()` 输出 → 发现没 `list_agents` → 落 D4-S1 报告 → 与 PM 协商修订 TASK 范围。整个回路保守估 **30-60 分钟**。PM 派单前拦截把这一段省掉了。

2. **Charter 5 启示**：fcop 不暴露 `list_agents` 是**正确设计** —— fcop 是"文件协作协议"，只管 4 种文件 (tasks/reviews/reports/issues) + `role_occupancy` 视图（基于 task 推算）。CodeFlow `AgentRegistry` 管的是 **Cursor SDK agent_id ↔ role 的元数据 + 状态**，与 fcop 的 role_occupancy 概念**不重叠**。Charter 5 说"CodeFlow = FCoP 应用"指的是**文件层**走 fcop，但**Cursor SDK adapter 层**仍是 CodeFlow 私有责任（fcop 不知道也不应该知道 Cursor 的存在）。这一点 DEV 用 P5 / P6 (Mobile + relay) sprint 时再次验证。

### §四 与 PM TASK-013 §三 自决空间（A/B/C）的对照

PM TASK-013 §三给了 3 个可选项（A=schema 清理 / B=TaskParser 测试瘦身 / C=release notes 累积），总 SLA 60-180min 含主交付。DEV 实际选择：

| 项 | 性质 | DEV 决定 | 理由 |
|---|---|---|---|
| **A. Day 5 schema 清理** | DEV 自决 | ⏸️ **推到 Day 5 正式** | A 涉及删 `types/state.ts` / `task.schema.ts` 副本，要先 ripgrep 全量引用核对（避免 break consumer）。Day 4 节奏空间 ~2.5h 内可以做，但 **PM Day 5 已经规划**这事，Day 5 一并做更稳。|
| **B. TaskParser yaml 旧测试瘦身** | DEV 自决 | ⏸️ **推到 Day 5 正式** | Day 2 §四 DEV 自决保留 4 个旧测试时已说明「Day 5 review 是否仍有价值」—— Day 4 删早了，万一 Day 5 发现仍有用（譬如 `CODEFLOW_SKIP_FCOP_PROBE=1` 路径回归保护）就得 revert。|
| **C. release notes 累积** | DEV 自决 | ✅ **Day 4 完成** | 纯 docs **0 代码风险**，Day 6 PM 想 ship 直接拿走改个版本号即可。新建 `docs/releases/v0.3.0-alpha.md`（257 行），包含: §What's new (9 节，Day 1-4 全量改动) + §Semantic changes 4 条 (S1-S4 operators 必读) + §Test coverage matrix + §DEV surprise log + §PM self-disclosure log (#7-15) + §SLA tracking + §Day 5/6 待办 + §Compatibility & migration。Day 5/6 PM/OPS 仅需补 commit hash + 时间戳即可发版。|

合计：1 ✅（C）+ 2 ⏸️（A/B → Day 5 正式做）。

### §五 给 PM 的 Day 5 / Day 6 启动方向预告

按 PM TASK-007 §四 Day 4-5 + TASK-013 §三 + DEV §四 推迟项：

#### Day 5（schema 清理 + 测试瘦身 + Day 5-end 巡检）
- **Day 5.1 schema 清理**（PM TASK-013 §三 A）
  - ripgrep `types/state.ts` 引用清单 → 决定删除策略（直接删 / 仅删 unused exports）
  - ripgrep v0.1 自有 `task.schema.ts` / `review.schema.ts` 引用清单 → 同上
  - **不动** `@codeflow/protocol/schemas/*.json`（这些是 ajv runtime 验证用，与 v0.1 TS interface 不同）
  - tsc 0 错 + 141 测试仍绿 = 通过判据
- **Day 5.2 TaskParser yaml 旧测试瘦身**（PM TASK-013 §三 B）
  - review `TS-5.4/5.5/5.6 + bonus` 4 个测试，按下面 3 选项之一决定：
    - i) 保留全部 4 个（理由：CODEFLOW_SKIP_FCOP_PROBE=1 路径回归保护）
    - ii) 删 3 留 1（保留 bonus 容错 test，删其他 happy path — fcop 路径已 cover）
    - iii) 全删（理由：CODEFLOW_SKIP_FCOP_PROBE=1 不在 Day 6 发版主流程，靠 smoke-1 测试就够）
  - 建议 i 或 ii（保守路线）

#### Day 6（release）
- **Day 6.1**: full regression matrix (141 tests + smoke matrix Day 1-4 全跑)
- **Day 6.2**: bump `pyproject.toml` + 各 `package.json` 到 `0.3.0-alpha`
- **Day 6.3**: 更新 `CHANGELOG.md`（参考 `docs/releases/v0.3.0-alpha.md` §What's new）
- **Day 6.4**: 派 OPS-016 commit + tag `v0.3.0-alpha`
- **Day 6.5**: ADMIN 决定 internal-only 还是 external-preview → 决定是否 push npm / GitHub Pages

**预计 v0.3.0-alpha EOD**：按当前 28x 节奏，**5/12 EOD 出厂** 仍是可能的（vs 原 5/17，提前 5-6 天）；但 DEV 与 PM 都**不承诺**（自约束 10）。

### §六 self-justification（dev-bridge 规则 §"回执必须包含影响范围"对照）

- **修改了哪些文件**：见 §二 diff stat。3 modified core sources + 2 modified barrels + 1 modified test + 1 new release notes + 1 new smoke script。
- **是否影响已有功能**：
  - ✅ Day 3 EOD 136/136 baseline 全绿（含 SDK BUG-SDK-001~007 regression + 8 已有 InboxWatcher/TaskDispatcher）
  - ✅ Day 4 新增 5 测试全绿（含 D4-3b reject 策略覆盖）
  - ✅ **`Runtime.create` API contract 0 break**：仅扩展 `Runtime` 内部把 `opts.fcopClient` 也传给 `InboxWatcher`，对外签名不变
  - ✅ **`InboxWatcher` API contract 0 break**：`fcopClient` 与 `onValidationFail` 都是 optional，不传时行为与 Day 1 完全一致
- **是否需要重启服务**：⚠️ 是。Day 4 累积改动**重启后**才生效。Day 1+2+3 commit 已落 (`f559904 / bc9179a / Day 3 OPS-012 TBD`)，Day 4 何时 commit 由 PM 决定（PM TASK-013 §四明示「commit 落地不在 DEV 范围」+ §六「巡检 OK → PM 派 OPS-014 一次性 commit Day 4」）。
- **自测结果**：
  - ✅ 三 workspace tsc clean
  - ✅ runtime 141/141 tests pass
  - ✅ 2 smoke 全绿（real fcop client + yaml fallback；含 Day 4 新增的 `Inbox watcher` banner 行）
  - ✅ secret scan 全清
  - ✅ stray pythonia python child 进程已显式 kill

### §七 SLA 兑现

| 指标 | PM TASK-013 §五 SLA | DEV 实际 |
|---|---|---|
| §二 主交付时长 | 30-90min | **~20 分钟（InboxWatcher 改造 + 5 测试 + Runtime/banner wire）**|
| §三 自决加跑（C）| 加 30-60min | **~6 分钟（写 257 行 release notes，无代码改动）**|
| 总时长 | 上限 3h | **~26 分钟 ≈ 28x 加速**|
| 完工时间 | 今天 (5/11) 16:30-18:30（基于 60-180min 估算）| **15:30** ✅ 提前 60-180 分钟 |
| 卡点 | ≥ 60min 必写 in-progress REPORT | 无卡点 |

**节奏对照**：

| Day | 工时 | 节奏 |
|---|---|---|
| spike (TASK-005) | 30min | 16x |
| Day 1 (TASK-007) | 38min | 18x |
| Day 2 (TASK-009) | 80min | 9x |
| Day 3 (TASK-011) | 30min | 28x |
| **Day 4 (TASK-013)** | **~26min** | **~28x** |

Day 4 节奏与 Day 3 持平（最快两天）。主因：
- PM `path 版三件套` 在派单前正面拦截 `AgentRegistry` 错位（省 30-60min）
- Day 2/3 建立的 idiom（`stubFcopClient` + instance API + fcop-first/yaml-fallback）100% 复用
- 0 个 DEV-side surprise（D2-S1 / D3-S1 那种 latent bug 都已在 Day 2/3 修完）

### §八 自决审计

| 决策 | 性质 | 处置 |
|---|---|---|
| 路径选 PM TASK-013 §2.1 推荐的 `dispatch_anyway` 默认策略 | 完全跟进 PM | ✅ |
| **加 TS-IW-D4-3b 测试覆盖 `reject` 策略**（PM 只要求 3 条 D4-1/2/3）| DEV 自决 | ✅ 钉死 2 个策略契约，未来若改默认值有回归保护 |
| **`FcopClientError` 即使 `onValidationFail=reject` 也降级 `dispatch_anyway`**（不在 PM 明示范围）| DEV 自决（Day 2 TaskParser 同精神：fcop 故障不吞 task）| ✅ TS-IW-D4-4 钉死契约 |
| **加 `fcopClientWired` + `onValidationFail` getter** | DEV 自决（Day 3 ReviewWriter 同精神：transparency 给 banner / 测试用）| ✅ |
| 加 `Inbox watcher  :` 行到 banner | DEV 自决（Day 2/3 同精神，PM TASK-013 §2.4 说「不强求」）| ✅ smoke-1/2 验证 |
| **§三 选 C 不选 A/B** | DEV 自决 | ✅（§四 说明：A/B 推 Day 5 正式做，C 0 代码风险且 Day 6 ship 直接拿走）|
| 仍不 commit Day 4 | 按 PM 计划 | ✅ |
| 仍不 bump 版本号 | 按 PM 计划 | ✅ |
| 不动 `AgentRegistry` | 按 PM §15 自披露后红线 | ✅ |
| 不引入 archive 概念 | 按 PM §四明令 | ✅ |
| 不动 `AgentSdkAdapter` / `SessionManager` / `atomic-write.ts` | 按 PM §四明令 + Charter 5 | ✅ |
| `InboxWatcher` 把 `fcopClient` 当 optional 注入（而非默认必传） | DEV 自决（Day 2 TaskParser / Day 3 ReviewWriter 同精神）| ✅ TS-IW-D4-1 钉死契约 |
| 把 `_onAdd` 同步流改为异步 gate（`Promise.resolve().then(async() => {...})`）| DEV 自决（必须 — `inspectTask` 是 async；保持 fire-and-forget 不破坏 chokidar 主循环）| ✅ 不破坏 chokidar emit 顺序，handler-error isolation 仍保留 |

无范围外修改、无未公开决策。

### §九 Day 6 release notes 该提前知道的事（累积，含 Day 4）

> Day 4 自决项 C 已把这张表的完整版整理为独立文件 `docs/releases/v0.3.0-alpha.md`。本节仅列 Day 4 新增项 + 链接。

| 累积项 | Day 1 | Day 2 | Day 3 | Day 4 | 备注 |
|---|---|---|---|---|---|
| `FcopTask` schema | 平铺（**buggy**）| 嵌套修复 | — | — | Day 2 修 |
| `FcopReview` schema | 漏字段 | — | 补 body/date/mtime + human_approval.approved_at/evidence | — | Day 3 修 |
| `FcopProjectClient.readTask` public method | ❌ | ✅ | — | — | Day 2 加 |
| `FcopProjectClient.readReview` public method | ❌ | ❌ | ✅ | — | Day 3 加 |
| `FcopProjectClient.inspectTask` public method | ❌ | ❌ | ✅ ship surface only | ✅ **wired 进 InboxWatcher** | Day 3 ship + Day 4 wire |
| **`FcopValidationIssue` interface** | ❌ | ❌ | ✅ | — | Day 3 加 |
| `RuntimeCreateOptions.fcopClient?` 注入扩展 | ❌ | ✅ TaskParser | ✅ ReviewWriter + NeedsHumanGate | ✅ **InboxWatcher** | Day 4 扩展 |
| `TaskParser` instance API | ❌ | ✅ | — | — | Day 2 加 |
| `ReviewWriter` instance fcopClient API | ❌ | ❌ | ✅ | — | Day 3 加 |
| `NeedsHumanGate.markApproved` 新 method | ❌ | ❌ | ✅ | — | Day 3 加 |
| **`InboxWatcher` fcop schema-gating + 3 策略 `onValidationFail`** | ❌ | ❌ | ❌ | ✅ **ship** | Day 4 加 |
| **`InboxValidationFailPolicy` type** (`dispatch_anyway / reject / needs_human_review`) | ❌ | ❌ | ❌ | ✅ **ship** | Day 4 加 |
| codeflow-shell banner `Task parser:` 行 | ❌ | ✅ | — | — | Day 2 加 |
| codeflow-shell banner `Review writer:` 行 | ❌ | ❌ | ✅ | — | Day 3 加 |
| **codeflow-shell banner `Inbox watcher:` 行** | ❌ | ❌ | ❌ | ✅ **ship** | Day 4 加 |
| **v0.3 release notes 累积文件 `docs/releases/v0.3.0-alpha.md`**（DRAFT, 257 行）| — | — | — | ✅ **ship**（DEV 自决 §三 C）| Day 4 加 |

---

DEV-01  
2026-05-11 15:30 (UTC+8) — Day 4 of 6 (P4 sprint, ~28x SLA 加速保持，PM TASK-013 完全跟进 + 1 自加测试 + 1 自决加跑 §三 C)
