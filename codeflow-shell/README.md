# CodeFlow Shell — v0.2.0-beta.1 (MT-1 hotfix)

> ⚠️ **Internal preview release.** Not published to npm/PyPI/GitHub Releases. For ADMIN test only.
>
> **What's new since v0.2.0-beta (P2)**:
> - 🩹 **MT-1 hotfix (BUG-SDK-001)**: `CursorSdkAdapter` now wires `cfg.cursor.defaultModel` end-to-end into `Agent.create({ model })` and `agent.send({ model })`. Without this, every real-SDK task drop in `local` mode failed with `Local SDK agents require an explicit model.` (QA-009 §五). The fallback chain is `spec.modelId ?? this._opts.defaultModel ?? <omit>`, so cloud-mode users still get SDK auto-pick when neither is set.
> - 🆕 `CURSOR_DEFAULT_MODEL=auto` ships uncommented in `.env.example` so a fresh `cp .env.example ~/.codeflow/v2/.env` + add real key gives a working real-SDK setup with zero extra editing.
> - 🆕 Banner now prints a multi-line `WARNING` block when `live + local + no defaultModel` is detected, so you see the misconfig before dropping a task and waiting for the failure.
> - ✅ Runtime tests **99 → 104** (+5 TS-MODEL-1..5: model-injection seam tests via `Agent.create` / `Agent.resume` monkey-patch).
>
> **What's new since v0.2.0-alpha (P1, still active)**:
> - 🛠️ MT-2: `_internal/atomic-write.ts` now retries on Windows-NTFS `EPERM` race (50ms backoff × 3); fixes the cross-cutting bug surfaced in REPORT-028 / REPORT-002. Runtime tests 94 → 99 (4 new + 1 bonus, all green).
> - 📊 `docs/design/spike-exe-packaging.md` — full evaluation of 7 single-EXE packaging strategies (bun, pkg, nexe, Tauri, Node SEA × 3 esbuild variants). Verdict: all blocked by ESM/CJS + native sqlite3 + monorepo hoist three-way conflict. **`npm start` is the official v0.2 distribution method**, single-EXE is deferred to v1.0 with explicit re-eval gates documented.
> - 🪛 `pack.cmd` rewritten as **spike-only stub** — default invocation prints summary and dispatches to `npm start`; sub-commands `bun` / `sea-cjs` / `sea-esm` keep the spike attempts available for advance users.
>
> **What's new since v0.1.0-rc.1 (P1, still active)**:
> - 🆕 Real `CursorSdkAdapter` wiring (no longer hard-stubbed to `InMemorySdkAdapter`).
> - 🆕 `ConfigLoader` — 6-tier merge (`defaults` → `~/.codeflow/v2/config.json` → `./codeflow.config.json` → `~/.codeflow/v2/.env` → `./.env` → `process.env` → CLI args).
> - 🆕 `.env.example` whitelisted env vars.
> - Fallback to `InMemorySdkAdapter` is **still** the default when `CURSOR_API_KEY` is absent — first launch with no setup remains a smoke-test friendly experience.
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

> ⚠️ **v0.2.0-beta single-EXE status**: **deferred to v1.0**. After P2 spiked 7 packaging strategies (bun --compile, Node SEA × 3 esbuild variants, @vercel/pkg, nexe, Tauri sidecar), all routes are blocked by a 3-way conflict:
>
> 1. `@cursor/sdk@1.0.12` is a pure ESM package whose `dist/esm/index.d.ts` references `.js` files that don't exist in the published artifact (SDK packaging bug).
> 2. `@cursor/sdk → sqlite3 → bindings` requires the native `.node` binary to be physically resolvable from `process.cwd()/package.json` ancestor chain — not possible inside `bun --compile`'s virtual fs nor a Node SEA single-file binary.
> 3. monorepo workspace hoist puts `@cursor/sdk` under `packages/codeflow-runtime/node_modules/`, not `codeflow-shell/node_modules/` → ESM resolver from `dist/main.bundle.mjs` can't find it.
>
> Full RCA + re-eval gates: [`docs/design/spike-exe-packaging.md`](../docs/design/spike-exe-packaging.md). PM `TASK-007 §四 §2` explicitly blesses `npm start` as the **official v0.2 distribution method**; this is no longer a v0.1-style temporary fallback.

### Option A — npm script (official v0.2 distribution method)

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

### Option B — single-EXE — **DEFERRED to v1.0** (spike-only)

```powershell
cd codeflow-shell
npm install
.\pack.cmd                # default → forwards to `npm start` with explanation
.\pack.cmd bun            # spike: bun --compile (will fail at runtime with `bindings` error)
.\pack.cmd sea-cjs        # spike: esbuild CJS bundle (will fail at runtime — CJS can't require ESM)
.\pack.cmd sea-esm        # spike: esbuild ESM bundle (will fail at runtime — hoist mis-alignment)
.\pack.cmd --help         # banner
```

**Status (v0.2.0-beta): all 7 packaging strategies blocked.** See [`docs/design/spike-exe-packaging.md`](../docs/design/spike-exe-packaging.md) for the full RCA, the 4 re-eval gates (R-1..R-4), and the conditions under which v1.0 should retry. The default `pack.cmd` invocation now prints the spike summary and forwards to `npm start` so a casual user gets a working shell with one double-click.

---

## Configuration

The shell merges configuration from **six** layers (later layers override earlier):

1. **Built-in defaults** — `dataDir=~/.codeflow/v2/`, `listScope=local`, `defaultAgentKit=["DEV-01","REVIEW-01"]`.
2. `~/.codeflow/v2/config.json` — per-user persistent (recommended for personal Cursor key).
3. `./codeflow.config.json` (project root) — per-project pinned.
4. `~/.codeflow/v2/.env` + `./.env` — limited to a whitelist of `CURSOR_*` and `CODEFLOW_*` keys.
5. `process.env` — same whitelist.
6. CLI args — `--api-key`, `--relay-url`, `--room-key`, `--data-dir`.

### Whitelisted env vars

| Var | Purpose | Default |
|---|---|---|
| `CURSOR_API_KEY` | Activates real `CursorSdkAdapter`. **Without this, the shell uses `InMemorySdkAdapter` (smoke-test fallback)**. | unset |
| `CURSOR_DEFAULT_MODEL` | **Required when `CURSOR_LIST_SCOPE=local` (the default).** Forwarded to `Agent.create({ model })` and `agent.send({ model })`. v0.2.0-beta.1 (MT-1) wired this end-to-end — without it, every task drop fails at `agent.send()` with `Local SDK agents require an explicit model.` `auto` is the safest first choice; `claude-sonnet-4`, `gpt-5`, etc. are also valid where your account has access. | unset |
| `CURSOR_LIST_SCOPE` | `local` (per-cwd) or `cloud` (cross-machine). When `cloud`, the SDK auto-picks a default model so `CURSOR_DEFAULT_MODEL` becomes optional. | `local` |
| `CODEFLOW_DATA_DIR` | Override `dataDir` (skills/, inbox/, reviews/, transcripts/, sessions/, agents.json). | `~/.codeflow/v2/` |
| `CODEFLOW_RELAY_URL` | WebSocket URL for Mobile PWA bridge (P3, not yet active). | unset |
| `CODEFLOW_ROOM_KEY` | Relay room key. | unset |
| `CODEFLOW_RELAY_AUTOCONNECT` | `true`/`1` to auto-connect; auto-set when both URL + room key present. | unset |

### `config.json` schema

```jsonc
{
  "cursor": {
    "apiKey": "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "defaultModel": "claude-sonnet-4",
    "listScope": "local"
  },
  "relay": {
    "url": "wss://ai.chedian.cc/codeflow/ws/",
    "roomKey": "codeflow-replace-with-your-id",
    "autoConnect": true
  },
  "dataDir": "~/.codeflow/v2",
  "defaultAgentKit": ["DEV-01", "REVIEW-01"]
}
```

Every key is optional. The `~` prefix expands to `homedir()` for `dataDir`. Place the file at `~/.codeflow/v2/config.json` for a per-user pin, or at `./codeflow.config.json` for a project pin (commit-proof — `.env` and `codeflow.config.json` are both `.gitignore`d).

### Quick start: getting a Cursor API key

1. Open [https://cursor.com/settings](https://cursor.com/settings) → **Account** → **API keys**.
2. Click **Create new key**. Copy the value (starts with `crsr_`).
3. Pick **one** of the following options:
   - Easiest: `cp codeflow-shell/.env.example ~/.codeflow/v2/.env` then edit the COPY (never `.env.example` directly — see the warning block at the top of that file). Set `CURSOR_API_KEY=crsr_<your_real_key>`.
   - Per-project: same but copy to `codeflow-shell/.env`.
   - Per-shell: `set CURSOR_API_KEY=crsr_xxx` then `npm start` in the same window (PowerShell: `$env:CURSOR_API_KEY="crsr_xxx"`).
4. **Local mode requires a default model** (v0.2.0-beta.1 / MT-1, BUG-SDK-001). Either:
   - Keep the `CURSOR_DEFAULT_MODEL=auto` line that ships uncommented in `.env.example` (recommended first choice), OR
   - Switch to cloud mode by setting `CURSOR_LIST_SCOPE=cloud` (the SDK then auto-picks a default).

   Without one of those, every task drop fails at `agent.send()` with `Local SDK agents require an explicit model.` The shell prints a `WARNING` block in the banner if it detects this misconfiguration so you don't waste a 30-second governance loop discovering it.

5. Re-launch the shell. Banner should show:
   ```text
   Cursor SDK     : live (CursorSdkAdapter; apiKey from process.env.CURSOR_API_KEY, listScope="local", defaultModel="auto")
   ```
   instead of the v0.1 fallback line. The `defaultModel="..."` segment confirms the wire-through worked.

If the banner still shows `fake (InMemorySdkAdapter; ...)`, the key didn't reach the shell — the most common cause on Windows is forgetting to relaunch after editing `.env`. The shell reads config exactly once, at startup.

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
