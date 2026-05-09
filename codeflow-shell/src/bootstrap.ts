/**
 * Bootstrap helpers — fixture planting + shell-aware default seeding.
 *
 * The shell is **not** an admin tool — it does not implicitly create
 * agents or skills. But for v0.1 internal RC ADMIN test runs, the
 * shell DOES auto-plant a single bootstrap kit (1 fcop skill + 1 PM
 * agent + 1 DEV agent + 1 REVIEW agent) on first launch IF and only
 * if `<persistDir>/agents.json` is absent. Subsequent launches re-use
 * what's on disk (the runtime's `RuntimeBootstrap` handles rehydration).
 *
 * This is consistent with the Phase E demo (`examples/hello-world.ts`
 * in `@codeflow/runtime`) and gives ADMIN a working stage from a
 * single-EXE double-click.
 */

import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Runtime } from "@codeflow/runtime";

interface BootstrapKitOptions {
  /** Same `dataDir` the runtime is using; we plant `<dataDir>/skills/`. */
  dataDir: string;
  runtime: Runtime;
}

/**
 * Ensure all the directories the runtime expects exist BEFORE
 * `Runtime.create` runs. chokidar's watcher does not auto-create
 * its target dir — if `inbox/` is missing the dispatcher silently
 * watches a non-existent path and `Copy-Item` from PowerShell will
 * fail with "directory not found".
 *
 * Idempotent: every `mkdir` uses `recursive: true`.
 */
export async function ensureDataDirs(dataDir: string): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await mkdir(join(dataDir, "inbox"), { recursive: true });
  await mkdir(join(dataDir, "reviews"), { recursive: true });
  await mkdir(join(dataDir, "skills"), { recursive: true });
  await mkdir(join(dataDir, "sessions"), { recursive: true });
  await mkdir(join(dataDir, "transcripts"), { recursive: true });
}

/**
 * Plant 3 fixture skills (`fcop`, `git`, `review`) into
 * `<dataDir>/skills/` IF the directory is empty. Idempotent —
 * second call is a no-op. Skills MUST be present BEFORE
 * `Runtime.create` runs, but for v0.1 we plant after creation
 * and ask the operator to re-launch (or — simpler — do this in
 * `main.ts` BEFORE `Runtime.create`). See `main.ts` for the
 * actual call ordering.
 */
export async function plantSkillFixturesIfMissing(
  skillsDir: string,
): Promise<{ planted: number }> {
  await mkdir(skillsDir, { recursive: true });
  const fcopPath = join(skillsDir, "fcop.json");
  // Treat existence of fcop.json as the canary — it's the only kernel
  // skill and v0.1 cannot start without it.
  try {
    await stat(fcopPath);
    return { planted: 0 };
  } catch {
    // Fall through to plant.
  }

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
  return { planted: skills.length };
}

/**
 * Register the v0.1 RC default agent kit (DEV-01 + REVIEW-01) IF
 * the runtime's bootstrap reported zero existing records. Skipping
 * when records exist makes shell restarts fast and idempotent.
 *
 * The Hello World demo subject is delivered to `DEV-01`; the review
 * loop is handled by `REVIEW-01`. Together they're enough to show
 * a complete governance loop on the very first launch.
 */
export async function registerDefaultAgentKitIfEmpty(
  opts: BootstrapKitOptions,
): Promise<{ registered: number }> {
  const { runtime } = opts;
  const existing = await runtime.registry.list();
  if (existing.length > 0) {
    return { registered: 0 };
  }

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

  return { registered: 2 };
}
