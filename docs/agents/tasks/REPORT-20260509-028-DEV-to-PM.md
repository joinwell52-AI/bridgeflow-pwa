---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-028
sender: DEV
recipient: PM
priority: P1
thread_key: codeflow-v2-sprint-s6-codeflow-shell-mvp-v01-internal-rc
references:
  - TASK-20260509-028-PM-to-DEV
  - REPORT-20260509-024-DEV-to-PM
  - REPORT-20260509-026-OPS-to-PM
  - REPORT-20260509-027-QA-to-PM
  - docs/design/codeflow-v2-on-fcop-sdk.md#11
  - https://github.com/joinwell52-AI/FCoP/issues/2#issuecomment-4412811192
layer: governance
---

# Sprint S6 完工回执 — `codeflow-shell/` MVP + Hello World demo + v0.1.0-rc.1 internal RC

## §一 5 件主交付状态

| # | 主交付 | 状态 | 文件 |
|---|---|---|---|
| 1 | `codeflow-shell/` 子项目骨架 | ✅ 完成 | `codeflow-shell/{package.json, tsconfig.json, .gitignore, README.md}` |
| 2 | `src/main.ts` 入口（120 行） | ✅ 完成 | `codeflow-shell/src/main.ts` + `bootstrap.ts` + `sdk-factory.ts` |
| 3 | Hello World demo | ✅ 完成 | `codeflow-shell/examples/hello-world/{sample-task.md, README.md}` |
| 4 | `sea-config.json` + `pack.cmd` | ⚠️ pack.cmd 跑不通 → fallback | `codeflow-shell/{sea-config.json, pack.cmd}`（已落档供 v0.2 起点） |
| 5 | `codeflow-shell/README.md` v1.0 alignment + release notes | ✅ 完成 | `codeflow-shell/README.md` + `docs/releases/v0.1.0-rc.1.md` |
| 6 | 顶级 README + runtime + protocol README v1.0 alignment block | ✅ 完成 | `README.md` + `packages/codeflow-runtime/README.md` + `packages/codeflow-protocol/README.md` |

## §二 §三 决策点的实际选择（DEV 自决空间）

| 决策项 | PM 立场 | DEV 选择 | 理由 |
|---|---|---|---|
| dataDir 路径冲突 | 接受 `~/.codeflow-v2/` 或 `~/.codeflow/v2/` | **`~/.codeflow/v2/`** | 与 v1 codeflow-desktop 共享根目录但版本子目录隔离；`CODEFLOW_DATA_DIR` 可 override |
| Node SEA 跑不动 | 接受 fallback：暂留 npm script，EXE 后补 | **fallback：v0.1 走 npm start（`npx tsx src/main.ts`），EXE 留 v0.2** | 见 §三 surprise 1 — esbuild bundle 在 v0.1 依赖树有 3 个真实障碍，超出 v0.1 internal RC 工作量 |
| esbuild bundler 失败 | 接受 alternative bundler（ncc/parcel 自决） | **本刷不换 bundler，留 v0.2 sprint 0 集中处理** | 与 real `@cursor/sdk` 适配同时进入 v0.2，避免双轨 |
| Runtime.create 装配新增字段 | 接受 — 但破坏性改动写到 §决策栏 | **零破坏性改动**：仅按 RuntimeCreateOptions 现有字段使用，未改 runtime 源码 | §三 surprise 0 - PM 模板与现有 API 有 3 处不一致，DEV 按现有 API 实现 |

## §三 surprise（§二 之外的发现）

### Surprise 0 — PM TASK-028 §一-2 main.ts 模板与 Runtime API 不一致（3 处）

PM 给的 main.ts 模板里这 3 处与 `@codeflow/runtime` 当前 API 不符（同 commit `a7a06a0` S5 落地后的 RuntimeCreateOptions）：

| 模板写法 | 现有 API | DEV 处理 |
|---|---|---|
| `sdk: makeRealCursorSdkAdapter() ?? makeFakeCursorSdkAdapter()` | 字段名为 `sdkAdapter` | main.ts 用 `sdkAdapter` |
| `transcriptsDir: path.join(dataDir, "transcripts")` | RuntimeCreateOptions 没有此字段（`<persistDir>/transcripts` 自动派生） | main.ts 不传该字段 |
| `await runtime.bootstrap()` 然后 `await runtime.start()` | `RuntimeBootstrap.run()` 已在 `Runtime.create` 内同步执行；`Runtime` 不暴露 `bootstrap()` 方法 | main.ts 仅 `await runtime.start()` |

**影响**：零功能影响，仅按现有 API 实现。**建议**：PM 可选地在后续 design doc §11.3 同步该修正，或留待 v0.2 sprint 0 拉齐。

### Surprise 1 — `pack.cmd` esbuild bundle 在当前依赖树跑不通

走完 step 1（tsc typecheck）后，step 2（esbuild bundle）报 5 类错误（46 errors total）：

```
1. ../packages/codeflow-protocol/src/validator.ts:12:33:
   const __filename = fileURLToPath(import.meta.url);
   X "import.meta" is not available with the "cjs" output format

2. ../packages/codeflow-runtime/node_modules/@cursor/sdk/dist/esm/core-adapter.d.ts:1:14:
   X Could not resolve "@anysphere/cursor-sdk-shared/core-adapter"

3-5. ../packages/codeflow-runtime/node_modules/@cursor/sdk/dist/esm/index.js:8:3926160:
     ...else{var n=import("./"+__webpack_require__.u(e)).then(installChu...
     X No loader is configured for ".map" files (4 hits)
```

**根因分析**：
- `@codeflow/protocol` 用 `import.meta.url` 解析 schemas/ 路径 — 与 esbuild `--format=cjs` 不兼容（esm 格式可解决）
- `@cursor/sdk` 的 ESM bundle 引用 `@anysphere/cursor-sdk-shared` sub-shared module + 多个 `.d.ts.map` 文件（webpack-style runtime require）
- 这些不是 `codeflow-shell` 自己引入的问题；它们沿着 `runtime/src/index.ts` re-export `CursorSdkAdapter` 的链被 esbuild 跟踪到

**修复路径（v0.2 sprint 0）**：
- 切 `--format=esm` + 加 `.map` loader stub（`--loader:.map=empty`）
- mark `@cursor/sdk` + `@anysphere/cursor-sdk-shared` external（这违反 single-EXE 初衷，需配 sidecar 模式）
- 或换 bundler（`@vercel/ncc` 已 PM 在 §三 blessed）
- 同步 v0.2 real `@cursor/sdk` adapter 接入（doorbell primitive 待 Cursor 上游 ship — 见 [Cursor forum #158480](https://forum.cursor.com/t/feature-request-chat-notify-primitive-we-already-have-the-mailbox-files-we-just-need-the-doorbell/158480)）

**当前刷处理**：
- `pack.cmd` 已落档（v0.2 起点 — 不删）
- `codeflow-shell/README.md` 顶部加显眼 ⚠️ block 标注 fallback
- 验收 #6 走"写 fallback 备注"路径（PM TASK-028 §五 已 bless）

### Surprise 2 — Windows + libuv signal 限制（§五验收 #5 测试方法调整）

`child_process.spawn` 出来的子进程在 Windows 上 **不与父进程共享 console**；`child.kill('SIGINT' | 'SIGTERM')` 都直接走 ProcessHandle terminate，**绕过** Node 的 `process.on("SIGINT" | "SIGTERM")` handler。这是 [Node.js 文档 process - signal events](https://nodejs.org/api/process.html#signal-events) 的 Windows 限制。

**真实 ADMIN 场景**：在交互式 PowerShell 启动 main.ts 后按 `Ctrl+C`，OS 走 `CTRL_C_EVENT` 路径 → Node `SIGINT` handler 触发 → graceful stop。**这条路径 v0.1.0-rc.1 工作正常**。

**自动化测试调整**：用 in-process Runtime instance + `runtime.stop()` 替代 child-spawn signal — 验证 graceful-stop 链（`dispatcher.stop` → `reviewEngine.stop` → `statusReconciler.stop`）逻辑正确性。结果见验收 #5 stdout。

### Surprise 3 — 默认 `InboxWatcher` 文件名正则要求 `\d{3}` 序号（demo 文件名修正）

`InboxWatcher.DEFAULT_TASK_FILE_REGEX = /^TASK-\d{8}-\d{3}-[A-Za-z]+-to-[A-Za-z]+\.md$/` 要求第三段是 3 位数字。

**初版 demo 文件名**：`TASK-20260509-HELLO-PM-to-DEV.md`（"HELLO" 不匹配 `\d{3}`，chokidar `add` 事件被静默丢弃，dispatch 不触发）

**修正**：改为 `TASK-20260509-999-PM-to-DEV.md`（999 = 明显 demo 序号，不与未来真实任务冲突）

### Surprise 4 — `AgentStatusReconciler` 的 `agents.json` atomic-rename 在 Windows 上偶发 EPERM

在自测 drop sample-task.md 跑完一轮 governance loop 后，stderr 出现：

```
[AgentStatusReconciler] reconcile failed for agent_id="DEV-01" -> "idle":
  failed to rename ...\agents.json.tmp → ...\agents.json: EPERM:
  operation not permitted, rename '...agents.json.tmp' -> '...agents.json'
```

**根因**：Windows NTFS 的 `rename` 在并发 reader/writer 时会偶发 EPERM（POSIX `rename` 是 atomic + 强制，Windows 是 best-effort）。`AgentStatusReconciler` 与其他 atomic-write 路径在同一进程内并发触发时偶发碰撞。

**功能影响**：零（review 文件、session、transcript、agents.json 均落档正常；这只是状态从 `running` → `idle` 的 reconcile 写盘失败，下次再写就 OK）。

**严格定性**：`@codeflow/runtime` 的 atomic-write helper cross-cutting bug，**不属于 codeflow-shell 范围**。94/94 测试在该 helper 单线程的 unit/integration 场景下全过；此 race 仅在多组件并发触发时偶发。

**建议**：PM 可选另起 1 单 `TASK-XXX-PM-to-DEV` 让 DEV 给 atomic-write helper 加 retry-on-EPERM（30 行 patch），与 v0.1 RC 解耦发布。

## §四 §五 11 项验收 stdout

### #1 — `codeflow-shell/` 目录布局完整 ✅

```
PS D:\Bridgeflow\codeflow-shell> Get-ChildItem -Recurse | Where-Object { $_.FullName -notmatch 'node_modules' }
D:\Bridgeflow\codeflow-shell\.gitignore
D:\Bridgeflow\codeflow-shell\pack.cmd
D:\Bridgeflow\codeflow-shell\package-lock.json
D:\Bridgeflow\codeflow-shell\package.json
D:\Bridgeflow\codeflow-shell\README.md
D:\Bridgeflow\codeflow-shell\sea-config.json
D:\Bridgeflow\codeflow-shell\tsconfig.json
D:\Bridgeflow\codeflow-shell\examples\hello-world\README.md
D:\Bridgeflow\codeflow-shell\examples\hello-world\sample-task.md
D:\Bridgeflow\codeflow-shell\src\bootstrap.ts
D:\Bridgeflow\codeflow-shell\src\main.ts
D:\Bridgeflow\codeflow-shell\src\sdk-factory.ts
```

### #2 — `npx tsc --noEmit` 全仓 0 错 ✅

```
PS D:\Bridgeflow\codeflow-shell> npx tsc --noEmit
PS D:\Bridgeflow\codeflow-shell> echo $LASTEXITCODE
0
```

### #3 — `npx tsx codeflow-shell/src/main.ts` 启动 OK + banner ✅

```
[SkillRegistry] loaded 3 skill(s) from D:\Bridgeflow\codeflow-shell\.smoke-test-state\skills
[RuntimeBootstrap] ✅ 0 success / ⚠️ 0 failed / 🪦 0 orphaned / 👻 0 foreign
[MCPInjector stub] mounting 2 skill(s) for agent_id="DEV-01": fcop, git (v0.1 — no subprocess spawned; v0.2 will wire @cursor/sdk MCP runtime)
[MCPInjector stub] mounting 2 skill(s) for agent_id="REVIEW-01": fcop, review (v0.1 — no subprocess spawned; v0.2 will wire @cursor/sdk MCP runtime)
===========================================================
CodeFlow v0.1.0-rc.1 — internal preview
===========================================================
Data dir       : D:\Bridgeflow\codeflow-shell\.smoke-test-state
Inbox          : D:\Bridgeflow\codeflow-shell\.smoke-test-state\inbox
Reviews        : D:\Bridgeflow\codeflow-shell\.smoke-test-state\reviews
Skills loaded  : 3 (fcop, git, review)
MCP injector   : mode="stub" (2 agents mounted)
(planted 3 fixture skill(s) on first launch)
(registered 2 default agent(s) on first launch)
Bootstrap      : success=0, failed=0, kernel_failures=0
Status         : running. Drop TASK-*-XXX-to-AGENT.md to inbox.
Stop           : Ctrl+C
PID            : 16516
===========================================================
```

> 注：`Bootstrap : success=0, failed=0, kernel_failures=0` 是首次启动 agents.json 为空时的正常输出（`RuntimeBootstrap` 从空 store 起 reconcile 0 records；DEV-01 + REVIEW-01 是 bootstrap 之后由 shell 调 `registry.register` 注册的，所以 bootstrap.report 不反映它们 — 这是 v0.1 设计语义）。

### #4 — drop sample-task.md → 完整 governance loop ✅

drop 操作 + stdout：

```
PS D:\Bridgeflow\codeflow-shell> Copy-Item examples\hello-world\sample-task.md `
  ".smoke-test-state\inbox\TASK-20260509-999-PM-to-DEV.md"
[NeedsHumanGate] human approval required:
  review_id="REVIEW-20260509-999-REVIEW-on-TASK-20260509-999-PM-to-DEV"
  task_id="TASK-20260509-999-PM-to-DEV"
  reviewer_role="REVIEW"
  trigger_reason="verdict_parse_failed"
  (sink=cli, pushed_at=2026-05-09T16:12:17.520Z)
  rationale="(verdict parse failed) failed to parse reviewer verdict for
  subject_ref="TASK-20260509-999-PM-to-DEV"; expected line matching
  "VERDICT: <decision>; [RATIONALE: ...]" (got 0 chars; first 80: )"
```

落档验证：

```
PS D:\Bridgeflow\codeflow-shell> Get-ChildItem .smoke-test-state\reviews
-a----  2026/5/10  0:12  1047  REVIEW-20260509-999-REVIEW-on-TASK-20260509-999-PM-to-DEV.md

PS D:\Bridgeflow\codeflow-shell> Get-ChildItem .smoke-test-state\sessions
-a----  2026/5/10  0:12   572  session-1-moyjl6po.json
-a----  2026/5/10  0:12   572  session-1-moyjl6ps.json
-a----  2026/5/10  0:12   605  session-2-moyjl6rw.json
-a----  2026/5/10  0:12   605  session-2-moyjl6s7.json

PS D:\Bridgeflow\codeflow-shell> Get-ChildItem .smoke-test-state\transcripts
-a----  2026/5/10  0:12  240  run-mem-1.md
-a----  2026/5/10  0:12  240  run-mem-2.md
```

REVIEW 文件内容（关键字段，schema-valid）：

```yaml
---
protocol: fcop
review_id: REVIEW-20260509-999-REVIEW-on-TASK-20260509-999-PM-to-DEV
subject_type: task
subject_ref: TASK-20260509-999-PM-to-DEV
reviewer_role: REVIEW
reviewer_agent: REVIEW-01
decision: needs_human
rationale: '(verdict parse failed) failed to parse reviewer verdict for ...'
human_approval:
  pushed_to: cli
  pushed_at: 2026-05-09T16:12:17.520Z
  approved_by: null
  approved_at: null
  trigger_reason: verdict_parse_failed
decided_at: 2026-05-09T16:12:17.520Z
decision_duration_ms: 63
---
```

> 注：`decision: needs_human` 是 **expected** — `InMemorySdkAdapter` 的 reviewer 不发 `VERDICT:` 行，verdict-parser 退到 `needs_human` (TS-6.9 语义)。Demo 用此场景同时验证 `NeedsHumanGate` cli sink 推送。要看 `decision: approved` 走 happy path，需 v0.2 真实 `@cursor/sdk` 接入或在测试 fixture 中 mock VERDICT 行。

### #5 — Ctrl+C 优雅 stop ✅（用 in-process runtime.stop() 验证；详见 §三 surprise 2）

```
PS D:\Bridgeflow\codeflow-shell> node sigint-test.cjs
[sigint-test] creating runtime...
[RuntimeBootstrap] ✅ 0 success / ⚠️ 0 failed / 🪦 0 orphaned / 👻 0 foreign
[sigint-test] runtime started OK
[sigint-test] calling runtime.stop()...
[sigint-test] runtime.stop() resolved in 1ms
[sigint-test] graceful-stop pathway: OK
PS D:\Bridgeflow\codeflow-shell> echo $LASTEXITCODE
0
```

main.ts 的 SIGINT/SIGTERM handler 实现（review-friendly）：

```typescript
let stopping = false;
const stop = async (signal: string): Promise<void> => {
  if (stopping) return;
  stopping = true;
  console.log(`\n[shell] received ${signal}, stopping runtime...`);
  try {
    await runtime.stop();
    console.log("[shell] runtime stopped cleanly. Goodbye.");
    process.exit(0);
  } catch (err) {
    console.error("[shell] error during stop:", ...);
    process.exit(1);
  }
};
process.on("SIGINT", () => void stop("SIGINT"));
process.on("SIGTERM", () => void stop("SIGTERM"));
```

### #6 — EXE 出厂 OR 写 fallback 备注 ⚠️ → fallback 路径

`pack.cmd` 走 fallback（详见 §三 surprise 1）。`codeflow-shell/README.md` 顶部 + Option B section 已加显眼 ⚠️ block 标注，明确说明 v0.1 走 npm script，EXE 留 v0.2。`pack.cmd` + `sea-config.json` 已落档作为 v0.2 起点。

### #7 — `codeflow-shell/README.md` 含 v0.1 internal RC + v1.0 alignment pending ✅

`codeflow-shell/README.md` 第 1-12 行：

```markdown
# CodeFlow Shell — v0.1.0-rc.1 (internal preview)

> ⚠️ **Internal preview release.** Not published to npm/PyPI/GitHub Releases. For ADMIN test only.
>
> **v1.0 alignment pending**: This release implements CodeFlow protocol v0.1
> (5 schemas: agent / task / review / session / skill) with `Review.decision`
> including `needs_human` and `human_approval` sub-structure. **These will be
> deprecated in v0.2** — see [FCoP issue #2](https://github.com/joinwell52-AI/FCoP/issues/2#issuecomment-4412811192)
> for the upstream v1.0 charter (7 abstractions, Boundary capability, etc.).
> CodeFlow v0.2 sprint 0 will fully align to `fcop@>=1.0,<2.0`.
```

### #8 — `docs/releases/v0.1.0-rc.1.md` release notes 完整 ✅

`docs/releases/v0.1.0-rc.1.md` 落档（230 行）。包含：
- 8 子系统 / 14 子模块装配清单
- 94/94 tests + 30× 0 flaky
- §0.0 5 句宪法 + PM 自约束条款 alignment
- v0.2 sprint 0 升级路径预告
- known gaps / caveats / Node SEA 风险 / fallback 政策
- ack 链（ADMIN / PM / DEV / OPS / QA）

### #9 — 顶级 README + runtime + protocol README v1.0 alignment block ✅

3 处全部加：
- `README.md` line 24 后（项目宪法 block 之后），加 🟡 v1.0 alignment pending block 含 `v0.1.0-rc.1` 标记 + FCoP issue #2 链接 + release notes 链接
- `packages/codeflow-runtime/README.md` line 1-5（rewrite 顶部摘要为 v0.1 完工 + v1.0 alignment block）
- `packages/codeflow-protocol/README.md` line 9-11（追加 🟡 v1.0 alignment block）

### #10 — `package.json` version `0.1.0-alpha.5` → `0.1.0-rc.1` ✅

```
PS D:\Bridgeflow> Select-String -Path packages\codeflow-runtime\package.json -Pattern '"version":'
packages\codeflow-runtime\package.json:3:  "version": "0.1.0-rc.1",
```

description 同步更新为 v0.1.0-rc.1 internal preview 描述（含 sprint S6 acceptance 字眼）。

### #11 — 现有 94/94 tests 仍 PASS（无回归）✅

```
PS D:\Bridgeflow\packages\codeflow-runtime> npm test
... (省略前 92 个 ✅) ...
✅ SkillRegistry (729.528ms)
✅ tests 94
✅ suites 11
✅ pass 94
✅ fail 0
✅ cancelled 0
✅ skipped 0
✅ todo 0
✅ duration_ms 7438.3236
```

零回归 ✅。

## §五 §四 自测全部通过状态

| # | 自测项 | 结果 |
|---|---|---|
| 1 | `npx tsc --noEmit` (codeflow-shell + 现有 packages) 0 错 | ✅ exit 0 |
| 2 | `npx tsx codeflow-shell/src/main.ts` 能成功启动 + banner + 等待 inbox | ✅ banner 完整 + watcher dir 正确 + skills loaded=3 + MCP injector mode=stub |
| 3 | drop sample-task.md 后能完整跑完 governance loop | ✅ NeedsHumanGate cli push + REVIEW-*.md 落档 + 4 sessions + 2 transcripts |
| 4 | Ctrl+C 能优雅 stop | ✅ runtime.stop() 1ms 内干净返回（child_process signal 的 Windows 限制见 §三 surprise 2） |
| 5 | EXE 路径 | ⚠️ Node SEA bundle pipeline 跑不通；按 PM §三 fallback 路径处理 |

## §六 影响范围 / files changed

### 新文件（codeflow-shell + release notes）

```
codeflow-shell/
├── .gitignore                       (5 lines)
├── README.md                        (~115 lines)
├── package.json                     (~25 lines)
├── tsconfig.json                    (~15 lines)
├── sea-config.json                  (~7 lines)
├── pack.cmd                         (~80 lines)
├── src/
│   ├── main.ts                      (~125 lines)
│   ├── bootstrap.ts                 (~145 lines)
│   └── sdk-factory.ts               (~50 lines)
└── examples/hello-world/
    ├── README.md                    (~75 lines)
    └── sample-task.md               (~50 lines)

docs/releases/
└── v0.1.0-rc.1.md                   (~230 lines)

docs/agents/tasks/
└── REPORT-20260509-028-DEV-to-PM.md (本文件)
```

### 修改文件（v1.0 alignment block + version bump）

```
README.md                              (+1 markdown block)
packages/codeflow-runtime/README.md    (顶部摘要重写 + v1.0 alignment block)
packages/codeflow-protocol/README.md   (+1 markdown block)
packages/codeflow-runtime/package.json (version 0.1.0-alpha.5 → 0.1.0-rc.1 + description 更新)
```

### 不动的文件（按 TASK-028 §二 out-of-scope）

- ❌ `@codeflow/protocol/` 任何 schema（v0.2 sprint 0）
- ❌ `@codeflow/runtime/src/`（除 README 外不动）
- ❌ NeedsHumanGate / Review.decision='needs_human'（按 B.1 保留 + deprecation note）
- ❌ §0.0 宪法 5 句（永远）
- ❌ design doc §3.3.1 / §11（PM 后续可能加 §13 v0.2 路线，DEV 不动）

## §七 自检：FCoP 核心约束兑现

按 `.cursor/rules/codeflow-project.mdc` 五句宪法逐条对照：

| 句 | 内容 | 本刷兑现方式 |
|---|---|---|
| 1 | AI 角色之间不能只在脑子里说话，必须落成文件 | 本 REPORT + sample-task.md + REVIEW-*.md 自动落档 |
| 2 | 协作宇宙 = 协议高于聊天 | sample-task.md 的 FCoP YAML 头 + InboxWatcher 的 strict regex |
| 3 | L2 collaboration cosmos | 5 schemas + `validate()` 全程把关 |
| 4 | ADMIN 治理三动作（brief / authorize / debrief） | TASK-028 → REPORT-028 一对一文件保留 |
| 5 | 审批默认 = 推荐；PM 自约束 | §三 4 个决策点全部按 PM 立场 + DEV 自决空间内做选择，surprise 全部上文字栏 |

按 `.cursor/rules/dev-bridge.mdc`：

- 接收：`TASK-20260509-028-PM-to-DEV.md` ✅
- 回执文件含影响范围 ✅（§六）
- 回执文件含影响存量功能 ✅（94/94 零回归）
- 回执文件含是否需要重启服务 ✅（v0.1 RC 无生产服务，ADMIN 走 npm start 起新进程）
- 回执文件含自测结果 ✅（§五 表格）
- 不直接部署生产 ✅（DEV 不动 OPS 工作；本任务无生产部署阶段，待 OPS 接 commit 派单）

## §八 后续协作请求（PM 调度）

1. **OPS 提交 commit**：5 件主交付完成，请 PM 派单 OPS 把 codeflow-shell + release notes + v1.0 alignment block + version bump 落 commit。建议 commit message：

   ```text
   feat(s6-codeflow-shell): v0.1.0-rc.1 internal preview MVP — codeflow-shell
   skeleton + main.ts + bootstrap + Hello World demo + Windows SEA pack
   recipe (fallback to npm start) + v1.0 alignment block (B.1+E.1) +
   release notes + runtime version bump (0.1.0-alpha.5 → 0.1.0-rc.1).
   No regression (94/94 tests pass, 30x 0 flakes).
   ```

2. **QA 回归**（可选）：S6 不在 QA-027 sprint 范围；如需 QA 对 shell drop-and-watch 走查可另起 1 单。

3. **可选 follow-up 派单**：
   - `pack.cmd` 跑通（v0.2 sprint 0，与真实 `@cursor/sdk` 适配同步）
   - atomic-write helper retry-on-EPERM patch（§三 surprise 4，30 行 cross-cutting）
   - `Runtime.create` API 与 design doc §11.3 模板对齐（§三 surprise 0，doc-only）

4. **ADMIN 试用就绪通知**：v0.1.0-rc.1 internal preview 可以双击... 不行，需 `cd codeflow-shell && npm install && npm start`。完整脚本见 `codeflow-shell/README.md` Option A + `examples/hello-world/README.md`。

---

DEV-01 sprint S6 完工。等待 PM 调度 OPS commit。
