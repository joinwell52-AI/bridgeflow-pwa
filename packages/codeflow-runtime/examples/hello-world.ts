/**
 * Hello-World demo for the CodeFlow AI Runtime (Sprint S3 Phase C).
 *
 * What this script proves:
 *   - InboxWatcher → TaskParser → AgentRegistry → SessionManager
 *     → StateHistoryWriter is a working pipeline
 *   - Dropping a `TASK-*-FOO-to-DEV.md` into `examples/inbox/` triggers
 *     a session via the InMemorySdkAdapter
 *   - state_history is appended to the dropped file
 *
 * What this script does NOT prove (that's S6's job):
 *   - Real `@cursor/sdk` integration — we use `InMemorySdkAdapter` which
 *     auto-emits a few synthetic events and settles successfully
 *   - codeflow-shell EXE bundling — that's Node SEA work in S6
 *   - Mobile push — v0.2
 *
 * Usage:
 *   npx tsx examples/hello-world.ts
 *
 * Press Ctrl+C to stop. The demo runs forever (idle watcher) until killed.
 */

import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { InMemorySdkAdapter, Runtime } from "../src/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  const inboxDir = join(__dirname, "inbox");
  const persistDir = join(__dirname, ".codeflow-state");

  // Fresh state for the demo — wipe the per-run sandbox.
  await rm(persistDir, { recursive: true, force: true });
  await mkdir(inboxDir, { recursive: true });
  await mkdir(persistDir, { recursive: true });

  const sdk = new InMemorySdkAdapter();

  const runtime = await Runtime.create({
    sdkAdapter: sdk,
    persistDir,
    inboxDir,
  });

  // Register one DEV agent so the dispatcher has someone to talk to.
  await runtime.registry.register({
    agent_id: "DEV-01",
    role: "DEV",
    layer: "worker",
    node: "local",
    runtime: "local",
    skills: ["fcop", "git"],
    status: "idle",
    workspace: process.cwd(),
  });

  await runtime.start();

  console.log("===========================================================");
  console.log("CodeFlow Runtime — Phase C Hello-World demo");
  console.log("===========================================================");
  console.log(`watcher ready    : ${runtime.watcher.dir}`);
  console.log(`dispatcher started`);
  console.log(`inbox empty      : drop a TASK-*-XXX-to-DEV.md to trigger`);
  console.log(`bootstrap report : success=${
    runtime.bootstrap.report.success.length
  }, failed=${runtime.bootstrap.report.failed.length}, ` +
    `orphaned=${runtime.bootstrap.report.orphaned.length}, ` +
    `foreign=${runtime.bootstrap.report.foreign.length}`);
  console.log("Press Ctrl+C to stop.");
  console.log("===========================================================");

  process.on("SIGINT", async () => {
    console.log("\n[SIGINT] stopping runtime…");
    await runtime.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[hello-world] fatal:", err);
  process.exit(1);
});
