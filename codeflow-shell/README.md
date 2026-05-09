# CodeFlow Shell — v0.1.0-rc.1 (internal preview)

> ⚠️ **Internal preview release.** Not published to npm/PyPI/GitHub Releases. For ADMIN test only.
>
> **v1.0 alignment pending**: This release implements CodeFlow protocol v0.1
> (5 schemas: agent / task / review / session / skill) with `Review.decision`
> including `needs_human` and `human_approval` sub-structure. **These will be
> deprecated in v0.2** — see [FCoP issue #2](https://github.com/joinwell52-AI/FCoP/issues/2#issuecomment-4412811192)
> for the upstream v1.0 charter (7 abstractions, Boundary capability, etc.).
> CodeFlow v0.2 sprint 0 will fully align to `fcop@>=1.0,<2.0`.

---

The minimal executable wrapper around `@codeflow/runtime`. The shell is a **thin Layer-1 entry point** (design doc §11.2-§11.5) that:

1. Resolves `dataDir` (defaults to `~/.codeflow/v2/`).
2. Plants fixture kernel skills (`fcop` / `git` / `review`) on first launch.
3. Constructs `Runtime` (synchronously runs `RuntimeBootstrap`).
4. Registers `DEV-01` + `REVIEW-01` if `agents.json` is empty.
5. Starts the dispatcher / review engine / status reconciler.
6. Waits for `SIGINT` → graceful stop.

What it does **not** do (deferred to v0.2 — see [TASK-20260509-028 §二](../docs/agents/tasks/TASK-20260509-028-PM-to-DEV.md)):

- ❌ tray icon (system tray)
- ❌ web panel (Express + PWA)
- ❌ relay bridge (Mobile PWA over WebSocket)
- ❌ macOS / Linux packaging
- ❌ self-startup registration / single-instance mutex
- ❌ real `@cursor/sdk` (uses `InMemorySdkAdapter` in v0.1 — see `src/sdk-factory.ts`)

---

## Quick start

> ⚠️ **v0.1.0-rc.1 SEA/EXE status**: `pack.cmd` is **not currently green** on Node 24.14.0 + esbuild bundle. The bundler hits `@cursor/sdk` internal `.d.ts.map` references and `import.meta.url` in `@codeflow/protocol`'s validator (`cjs` format incompatibility). The PM `TASK-028 §三` explicitly accepted this fallback: **v0.1 ADMIN test runs via `npm start` (Option A); EXE bundling is rolled to v0.2 sprint 0** alongside the real `@cursor/sdk` adapter wiring (which itself blocks on Cursor's doorbell primitive). See [REPORT-20260509-028-DEV-to-PM.md](../docs/agents/tasks/REPORT-20260509-028-DEV-to-PM.md) §决策栏 for the full root cause + retry plan.

### Option A — npm script (works today, recommended fallback)

```powershell
cd codeflow-shell
npm install
npm start
```

You should see a banner like:

```text
===========================================================
CodeFlow v0.1.0-rc.1 — internal preview
===========================================================
Data dir       : C:\Users\me\.codeflow\v2
Inbox          : C:\Users\me\.codeflow\v2\inbox
Reviews        : C:\Users\me\.codeflow\v2\reviews
Skills loaded  : 3 (fcop, git, review)
MCP injector   : mode="stub" (2 agents mounted)
(planted 3 fixture skill(s) on first launch)
(registered 2 default agent(s) on first launch)
Bootstrap      : success=2, failed=0, kernel_failures=0
Status         : running. Drop TASK-*-XXX-to-AGENT.md to inbox.
Stop           : Ctrl+C
PID            : 12345
===========================================================
```

In another PowerShell window:

```powershell
copy codeflow-shell\examples\hello-world\sample-task.md "$env:USERPROFILE\.codeflow\v2\inbox\"
```

The main window's stdout will stream the full governance loop. See [`examples/hello-world/README.md`](examples/hello-world/README.md) for the expected log lines.

### Option B — single-EXE (Node SEA, Windows) — **DEFERRED to v0.2**

```powershell
cd codeflow-shell
npm install
.\pack.cmd
```

**Status (v0.1.0-rc.1): not green.** The pack pipeline (tsc typecheck → esbuild bundle → SEA blob → postject inject) currently fails at the esbuild step on three fronts:

1. `@cursor/sdk`'s ESM bundle references `.d.ts.map` files which esbuild has no loader for.
2. `@codeflow/protocol/src/validator.ts` uses `import.meta.url`, which is empty under esbuild's `--format=cjs` output.
3. `@cursor/sdk` re-exports from `@anysphere/cursor-sdk-shared/core-adapter`, which esbuild cannot resolve from the bundle root.

These are **bundler-tooling issues in the v0.1 dependency tree**, not Node SEA limitations per se — they require either (a) external-marking the cursor SDK + its sub-shared module + a `--format=esm` switch + a `.map` loader stub, or (b) a different bundler (`@vercel/ncc` looks promising; PM `TASK-028 §三` blesses this swap).

**v0.1 RC fallback (PM-blessed)**: ADMIN uses Option A (`npm start`). EXE bundling will be re-attempted in v0.2 sprint 0 alongside the real `@cursor/sdk` adapter wiring. `pack.cmd` is committed for v0.2's starting point.

If you want to experiment with EXE locally: `pack.cmd` is the recipe. If it succeeds, double-click `dist\CodeFlow-v0.1.0-rc.1.exe`.

---

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `CODEFLOW_DATA_DIR` | `~/.codeflow/v2/` | Override the data directory (skills/, inbox/, reviews/, transcripts/, sessions/, agents.json). v1 codeflow-desktop uses `~/.codeflow/` directly; we keep `v2` separate to avoid clashing. |

There are intentionally no other knobs at this stage — the shell is a packaging layer, not a config surface. Runtime-level tuning (e.g., `reviewPolicy`) goes through `Runtime.create` and is not yet exposed.

---

## File layout

```
codeflow-shell/
├── src/
│   ├── main.ts              ← entry point — orchestrates 1-7 above
│   ├── bootstrap.ts         ← skill / agent fixture planters
│   └── sdk-factory.ts       ← real ?? fake SDK adapter chain
├── examples/
│   └── hello-world/
│       ├── sample-task.md   ← demo TASK to drop into inbox/
│       └── README.md        ← expected stdout + run instructions
├── sea-config.json          ← Node SEA config (Node 22+ stable, 24+ recommended)
├── pack.cmd                 ← Windows SEA pack script
├── package.json             ← name=codeflow-shell, private=true, deps on @codeflow/{runtime,protocol}
├── tsconfig.json            ← strict, ES2022 / NodeNext
├── README.md                ← (this file)
└── .gitignore               ← node_modules, dist, *.log
```

---

## v0.2 roadmap (not in this release)

| feature | tracking |
|---|---|
| tray + web panel + relay bridge | v0.2 sprint 1+ |
| macOS / Linux pack scripts | v0.2 sprint 1 |
| Real `@cursor/sdk` adapter | v0.2 sprint 0 (waits on `@cursor/sdk` doorbell primitive — see Cursor forum #158480) |
| Drop `Review.decision="needs_human"` enum | v0.2 sprint 0 (FCoP issue #2 alignment) |
| Boundary capability schema | v0.2 sprint 0 |
| Mobile PWA pairing | v0.2 sprint 1 |

---

## License

MIT. Same as the rest of the CodeFlow tree.
