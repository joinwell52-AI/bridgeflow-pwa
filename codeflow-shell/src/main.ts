/**
 * codeflow-shell main entry — v0.1.0-rc.1 (internal preview).
 *
 * Reference:
 *   - design doc §11.2 + §11.3 (Layer 1 minimal entry)
 *   - TASK-20260509-028-PM-to-DEV §一 主交付 2
 *
 * What this binary does:
 *
 *   1. Resolve `dataDir` (defaults to `~/.codeflow/v2/` — separate from
 *      v1 codeflow-desktop's `~/.codeflow/` to avoid state collision;
 *      decision §三-A from REPORT-028).
 *   2. Plant fixture skills (fcop / git / review) if absent.
 *   3. Construct `Runtime` (which synchronously runs RuntimeBootstrap).
 *   4. Register DEV-01 + REVIEW-01 if agents.json is empty.
 *   5. Start dispatcher / review engine / status reconciler.
 *   6. Print banner with watcher dir + PID for ADMIN.
 *   7. Wait for SIGINT → graceful stop.
 *
 * What this binary does NOT do (out-of-scope for MVP, per TASK-028 §二):
 *
 *   - tray icon, web panel, mobile relay bridge → v0.2
 *   - real `@cursor/sdk` integration → v0.2 (see sdk-factory.ts)
 *   - Mobile pairing / QR codes → v0.2
 *
 * Notes for the runtime API contract:
 *
 *   - PM TASK-028 §一-2 sample code uses `sdk: ...` and a
 *     non-existent `transcriptsDir` field, plus `runtime.bootstrap()`.
 *     The real Runtime API is `sdkAdapter`, no `transcriptsDir`
 *     (it's auto-derived from `persistDir`), and bootstrap runs
 *     synchronously inside `Runtime.create`. This file uses the real
 *     API; the discrepancies are documented in REPORT-028 §决策栏.
 */

import { homedir } from "node:os";
import { join } from "node:path";

import { Runtime } from "@codeflow/runtime";

import {
  ensureDataDirs,
  plantSkillFixturesIfMissing,
  registerDefaultAgentKitIfEmpty,
} from "./bootstrap.ts";
import {
  makeFakeCursorSdkAdapter,
  makeRealCursorSdkAdapter,
} from "./sdk-factory.ts";

const VERSION = "0.1.0-rc.1";

interface ShellLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

const consoleLogger: ShellLogger = {
  info: (msg) => console.log(msg),
  warn: (msg) => console.warn(msg),
  error: (msg) => console.error(msg),
};

async function main(): Promise<void> {
  // ── 1. Resolve dataDir ──────────────────────────────────────────────
  // Default: `~/.codeflow/v2/`. Decision §三-A (REPORT-028): we live
  // under `.codeflow/v2/` rather than `.codeflow/` so v1 codeflow-desktop's
  // `~/.codeflow/` (panel/, logs/, etc.) does not get clobbered.
  // ADMIN can override with `CODEFLOW_DATA_DIR`.
  const dataDir =
    process.env["CODEFLOW_DATA_DIR"] ?? join(homedir(), ".codeflow", "v2");
  const inboxDir = join(dataDir, "inbox");
  const skillsDir = join(dataDir, "skills");

  // ── 2a. Ensure all data dirs exist BEFORE Runtime.create ──────────
  // chokidar's watcher does NOT auto-create its target dir — if
  // `inbox/` is missing on first launch it would silently watch a
  // non-existent path AND ADMIN's `Copy-Item` would fail with
  // "directory not found".
  await ensureDataDirs(dataDir);

  // ── 2b. Plant fixture skills BEFORE Runtime.create ─────────────────
  // SkillRegistry.load() runs synchronously inside Runtime.create —
  // if no fcop skill is present the kernel-dep validator would
  // reject every agent register. Plant first.
  const skillResult = await plantSkillFixturesIfMissing(skillsDir);

  // ── 3. Construct runtime (bootstrap runs synchronously) ────────────
  const sdkAdapter =
    makeRealCursorSdkAdapter() ?? makeFakeCursorSdkAdapter();
  const runtime = await Runtime.create({
    sdkAdapter,
    persistDir: dataDir,
    inboxDir,
    skillsDir,
    logger: consoleLogger,
  });

  // ── 4. Register default agent kit ──────────────────────────────────
  const agentResult = await registerDefaultAgentKitIfEmpty({
    dataDir,
    runtime,
  });

  // ── 5. Start ───────────────────────────────────────────────────────
  await runtime.start();

  // ── 6. Banner ──────────────────────────────────────────────────────
  console.log("===========================================================");
  console.log(`CodeFlow v${VERSION} — internal preview`);
  console.log("===========================================================");
  console.log(`Data dir       : ${dataDir}`);
  console.log(`Inbox          : ${runtime.watcher.dir}`);
  console.log(`Reviews        : ${runtime.reviewWriter.reviewsDir}`);
  console.log(
    `Skills loaded  : ${runtime.skillRegistry.size()} ` +
      `(${runtime.skillRegistry.list().map((s) => s.skill_id).join(", ") || "(none)"})`,
  );
  console.log(
    `MCP injector   : mode="${runtime.mcpInjector.mode}" ` +
      `(${runtime.mcpInjector.listMounted().length} agents mounted)`,
  );
  if (skillResult.planted > 0) {
    console.log(
      `(planted ${skillResult.planted} fixture skill(s) on first launch)`,
    );
  }
  if (agentResult.registered > 0) {
    console.log(
      `(registered ${agentResult.registered} default agent(s) on first launch)`,
    );
  }
  console.log(
    `Bootstrap      : success=${runtime.bootstrap.report.success.length}, ` +
      `failed=${runtime.bootstrap.report.failed.length}, ` +
      `kernel_failures=${runtime.bootstrap.report.kernel_failures.length}`,
  );
  console.log(`Status         : running. Drop TASK-*-XXX-to-AGENT.md to inbox.`);
  console.log(`Stop           : Ctrl+C`);
  console.log(`PID            : ${process.pid}`);
  console.log("===========================================================");

  // ── 7. Graceful stop ───────────────────────────────────────────────
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
      console.error(
        "[shell] error during stop:",
        err instanceof Error ? err.message : err,
      );
      process.exit(1);
    }
  };
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));
}

main().catch((err) => {
  console.error("[shell] fatal:", err);
  process.exit(1);
});
