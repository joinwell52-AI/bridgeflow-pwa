/**
 * Hello-World demo for the CodeFlow AI Runtime (Sprint S3 Phase C +
 * Sprint S4 Phase D Review Engine + Sprint S5 Phase E Skill Runtime).
 *
 * What this script proves:
 *   - InboxWatcher → TaskParser → AgentRegistry → SessionManager
 *     → StateHistoryWriter is a working pipeline (Phase C)
 *   - Dropping a `TASK-*-FOO-to-DEV.md` into `examples/inbox/` triggers
 *     a session via the InMemorySdkAdapter (Phase C)
 *   - state_history is appended to the dropped file (Phase C)
 *   - Once the subject session settles, ReviewEngine + AgentStatusReconciler
 *     are wired in and ready to fire a reviewer subtask. With
 *     `InMemorySdkAdapter` (which doesn't emit a `VERDICT:` line),
 *     the verdict parser will fall back to `decision="needs_human"` and
 *     `NeedsHumanGate.push("cli")` will log a structured message to
 *     stdout. The resulting `REVIEW-*.md` lands in
 *     `<persistDir>/reviews/`. (Phase D)
 *   - Three fixture skills (`fcop`, `git`, `review`) are planted into
 *     `<persistDir>/skills/` BEFORE Runtime.create runs; SkillRegistry
 *     loads them, KernelDependencyValidator passes both DEV-01 and
 *     REVIEW-01, and MCPInjector emits a "stub-mode mounting" line for
 *     each (Phase E)
 *
 * What this script does NOT prove (that's S6's job):
 *   - Real `@cursor/sdk` integration — we use `InMemorySdkAdapter` which
 *     auto-emits a few synthetic events and settles successfully
 *   - codeflow-shell EXE bundling — that's Node SEA work in S6
 *   - Mobile push — v0.2 (sink="mobile" eager-throws today)
 *   - Real MCP-server spawning — v0.2 (mode="live" eager-throws today)
 *
 * Usage:
 *   npx tsx examples/hello-world.ts
 *
 * Press Ctrl+C to stop. The demo runs forever (idle watcher) until killed.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { InMemorySdkAdapter, Runtime } from "../src/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function plantDemoSkills(skillsDir: string): Promise<void> {
  await mkdir(skillsDir, { recursive: true });
  // 3 fixture skills wired into the demo. They are MINIMAL — just enough
  // structure to satisfy `skill.schema.json` + the `^fcop@.+`
  // `required_kernel.contains` clause.
  const skills = [
    {
      skill_id: "fcop",
      version: "1.0.0",
      provided_by: {
        type: "mcp_server",
        transport: "stdio",
        command: "node fcop-mcp-stub",
      },
      tools: [{ name: "drop_task" }],
      available_to_roles: ["DEV", "REVIEW", "PM", "OPS", "QA"],
      required_kernel: ["fcop@1.0"],
    },
    {
      skill_id: "git",
      version: "0.5.0",
      provided_by: {
        type: "mcp_server",
        transport: "stdio",
        command: "node git-mcp-stub",
      },
      tools: [{ name: "git_status" }, { name: "git_diff" }],
      available_to_roles: ["DEV"],
      required_kernel: ["fcop@>=1.0"],
    },
    {
      skill_id: "review",
      version: "0.1.0",
      provided_by: {
        type: "mcp_server",
        transport: "stdio",
        command: "node review-mcp-stub",
      },
      tools: [{ name: "fetch_diff" }, { name: "render_verdict" }],
      available_to_roles: ["REVIEW"],
      required_kernel: ["fcop@>=1.0"],
    },
  ];
  for (const skill of skills) {
    await writeFile(
      join(skillsDir, `${skill.skill_id}.json`),
      JSON.stringify(skill, null, 2),
      "utf-8",
    );
  }
}

async function main(): Promise<void> {
  const inboxDir = join(__dirname, "inbox");
  const persistDir = join(__dirname, ".codeflow-state");

  // Fresh state for the demo — wipe the per-run sandbox.
  await rm(persistDir, { recursive: true, force: true });
  await mkdir(inboxDir, { recursive: true });
  await mkdir(persistDir, { recursive: true });

  // Phase E: plant 3 fixture skills BEFORE Runtime.create runs (the
  // ctor synchronously loads them via SkillRegistry.load).
  const skillsDir = join(persistDir, "skills");
  await plantDemoSkills(skillsDir);

  const sdk = new InMemorySdkAdapter();

  // Logger that pipes SkillRegistry / KernelDependencyValidator /
  // MCPInjector / ReviewEngine / TaskDispatcher all to console — lets
  // the demo's stdout show every Phase E line.
  const logger = {
    info: (msg: string) => console.log(msg),
    warn: (msg: string) => console.warn(msg),
    error: (msg: string) => console.error(msg),
  };

  const runtime = await Runtime.create({
    sdkAdapter: sdk,
    persistDir,
    inboxDir,
    skillsDir,
    logger,
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

  // Phase D: register a reviewer so the review hook actually fires when
  // the DEV session settles. Without a registered REVIEW agent the
  // ReviewEngine would skip and fall back to `decision="needs_human" +
  // trigger_reason="reviewer_not_found"`.
  await runtime.registry.register({
    agent_id: "REVIEW-01",
    role: "REVIEW",
    layer: "worker",
    node: "local",
    runtime: "local",
    skills: ["fcop", "review"],
    status: "idle",
    workspace: process.cwd(),
  });

  await runtime.start();

  console.log("===========================================================");
  console.log("CodeFlow Runtime — Phase C + D + E Hello-World demo");
  console.log("===========================================================");
  console.log(`watcher ready     : ${runtime.watcher.dir}`);
  console.log(`reviews dir       : ${runtime.reviewWriter.reviewsDir}`);
  console.log(`skills dir        : ${runtime.skillRegistry.skillsDir}`);
  console.log(
    `skills loaded     : ${runtime.skillRegistry.size()} ` +
      `(${runtime.skillRegistry.list().map((s) => s.skill_id).join(", ")})`,
  );
  console.log(`mcpInjector       : mode="${runtime.mcpInjector.mode}" (v0.1 stub)`);
  console.log(`mounted agents    : ${runtime.mcpInjector.listMounted().join(", ") || "(none)"}`);
  console.log(`dispatcher        : started`);
  console.log(`reviewEngine      : started (DefaultReviewPolicy → REVIEW-01)`);
  console.log(`statusReconciler  : started (session ↔ Agent.status sync)`);
  console.log(`inbox empty       : drop a TASK-*-XXX-to-DEV.md to trigger`);
  console.log(`bootstrap report  : success=${
    runtime.bootstrap.report.success.length
  }, failed=${runtime.bootstrap.report.failed.length}, ` +
    `orphaned=${runtime.bootstrap.report.orphaned.length}, ` +
    `foreign=${runtime.bootstrap.report.foreign.length}, ` +
    `kernel_failures=${runtime.bootstrap.report.kernel_failures.length}`);
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
