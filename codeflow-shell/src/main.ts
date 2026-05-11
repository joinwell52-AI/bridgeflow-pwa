/**
 * codeflow-shell main entry — v0.2.0-beta.2 (MT-2 hotfix on top of MT-1).
 *
 * Reference:
 *   - design doc §11.2 + §11.3 (Layer 1 minimal entry)
 *   - TASK-20260510-002-PM-to-DEV §三 P1 §1 main.ts wiring (still in force)
 *   - TASK-20260510-007-PM-to-DEV §四 P2 §3 + §4 (P2 acceptance: spike + MT-2)
 *   - TASK-20260510-010-PM-to-DEV (MT-1 hotfix: defaultModel wire-through;
 *     adds banner WARNING block when live + local + no model)
 *   - TASK-20260510-012-PM-to-DEV (MT-2 hotfix: agent.send() carries
 *     local.force=true to expire wedged persisted runs; closes BUG-SDK-002.
 *     No banner change — fix is purely inside CursorSdkAdapter.send().)
 *   - TASK-20260510-013-PM-to-DEV (MT-3 hotfix: .env.example template
 *     CURSOR_DEFAULT_MODEL=auto → default; closes BUG-SDK-003.
 *     MT-4 hotfix: ReviewEngine.extractText() walks SDKAssistantMessage
 *     content[] array; closes BUG-SDK-004. No banner change — both
 *     fixes live in subordinate files.)
 *
 * Pipeline:
 *
 *   1. `loadConfig()` — merge defaults / config.json / .env / process.env / CLI args.
 *   2. Ensure data dirs exist (chokidar doesn't auto-create).
 *   3. Plant fixture skills if `<skillsDir>/fcop.json` is missing.
 *   4. Pick the SDK adapter — real CursorSdkAdapter if cfg.cursor.apiKey
 *      resolves, else InMemorySdkAdapter (smoke-test fallback).
 *   5. Construct Runtime (synchronously runs RuntimeBootstrap).
 *   6. Register the default agent kit if `agents.json` is empty.
 *   7. Start dispatcher / review engine / status reconciler.
 *   8. Print banner with config provenance + adapter mode + watcher dir + PID.
 *   9. Wait for SIGINT / SIGTERM → graceful stop.
 *
 * What this file does NOT do (deferred to later v0.2 phases):
 *
 *   - P2: replace EXE bundler (currently `npm start` only)
 *   - P3: instantiate `RelayBridge` from `cfg.relay.*`
 *   - P4: 7-schema rewrite (Boundary capability, etc.)
 */

import { join } from "node:path";

import { Runtime } from "@codeflow/runtime";

import {
  ensureDataDirs,
  plantSkillFixturesIfMissing,
  registerDefaultAgentKitIfEmpty,
} from "./bootstrap.ts";
import { loadConfig } from "./config.ts";
import {
  describeAdapterChoice,
  makeFakeCursorSdkAdapter,
  makeRealCursorSdkAdapter,
} from "./sdk-factory.ts";

const VERSION = "0.2.0-beta.2";

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

function describeSources(sources: ReturnType<typeof loadConfig>["sources"]): string {
  const order = [
    sources.userConfig ? "user-config" : null,
    sources.projectConfig ? "project-config" : null,
    sources.userEnvFile ? "user-env" : null,
    sources.projectEnvFile ? "project-env" : null,
    sources.processEnv ? "process.env" : null,
    sources.cliArgs ? "cli-args" : null,
  ].filter(Boolean);
  return order.length === 0 ? "defaults only" : order.join(" → ");
}

async function main(): Promise<void> {
  // ── 1. Resolve config (5-tier merge) ───────────────────────────────
  const cfg = loadConfig();
  const dataDir = cfg.dataDir;
  const inboxDir = join(dataDir, "inbox");
  const skillsDir = join(dataDir, "skills");

  // ── 2. Ensure all data dirs exist BEFORE Runtime.create ────────────
  await ensureDataDirs(dataDir);

  // ── 3. Plant fixture skills BEFORE Runtime.create ──────────────────
  const skillResult = await plantSkillFixturesIfMissing(skillsDir);

  // ── 4. Pick the SDK adapter ────────────────────────────────────────
  const sdkAdapter =
    makeRealCursorSdkAdapter(cfg.cursor) ?? makeFakeCursorSdkAdapter();
  const adapterDescription = describeAdapterChoice(cfg.cursor, sdkAdapter);

  // ── 5. Construct runtime (bootstrap runs synchronously) ────────────
  const runtime = await Runtime.create({
    sdkAdapter,
    persistDir: dataDir,
    inboxDir,
    skillsDir,
    logger: consoleLogger,
  });

  // ── 6. Register default agent kit ──────────────────────────────────
  const agentResult = await registerDefaultAgentKitIfEmpty({
    dataDir,
    runtime,
  });

  // ── 7. Start ───────────────────────────────────────────────────────
  await runtime.start();

  // ── 8. Banner ──────────────────────────────────────────────────────
  console.log("===========================================================");
  console.log(`CodeFlow v${VERSION} — internal preview`);
  console.log("===========================================================");
  console.log(`Data dir       : ${dataDir}`);
  console.log(`Inbox          : ${runtime.watcher.dir}`);
  console.log(`Reviews        : ${runtime.reviewWriter.reviewsDir}`);
  console.log(`Config sources : ${describeSources(cfg.sources)}`);
  console.log(`Cursor SDK     : ${adapterDescription}`);
  // MT-1 friendly hint: live adapter without a default model + local
  // listScope = nothing actually wrong yet, but every task drop will
  // fail at `agent.send()` with `Local SDK agents require an explicit
  // model.` We surface that up-front instead of letting users hit it
  // after a 30-second governance loop. (BUG-SDK-001 / TASK-007 §3.5)
  const listScope = cfg.cursor.listScope ?? "local";
  const liveAdapterPicked = adapterDescription.startsWith("live ");
  if (
    liveAdapterPicked &&
    listScope === "local" &&
    !cfg.cursor.defaultModel
  ) {
    console.warn(
      "WARNING        : live SDK + local mode + no CURSOR_DEFAULT_MODEL set.",
    );
    console.warn(
      "                 First task drop will fail with 'Local SDK agents",
    );
    console.warn(
      "                 require an explicit model.' Set CURSOR_DEFAULT_MODEL",
    );
    console.warn(
      "                 in ~/.codeflow/v2/.env (e.g. `auto`, `claude-sonnet-4`)",
    );
    console.warn(
      "                 or per-task `spec.modelId`. See README §Cursor API key.",
    );
  }
  console.log(
    `Skills loaded  : ${runtime.skillRegistry.size()} ` +
      `(${runtime.skillRegistry.list().map((s) => s.skill_id).join(", ") || "(none)"})`,
  );
  console.log(
    `MCP injector   : mode="${runtime.mcpInjector.mode}" ` +
      `(${runtime.mcpInjector.listMounted().length} agents mounted)`,
  );
  if (cfg.relay.autoConnect && cfg.relay.url && cfg.relay.roomKey) {
    console.log(
      `Relay (P3)     : ${cfg.relay.url} (room=${cfg.relay.roomKey}) — wiring deferred to v0.2.0-rc.1`,
    );
  } else {
    console.log(`Relay (P3)     : not configured (set CODEFLOW_RELAY_URL + CODEFLOW_ROOM_KEY to enable in P3)`);
  }
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

  // ── 9. Graceful stop ───────────────────────────────────────────────
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
