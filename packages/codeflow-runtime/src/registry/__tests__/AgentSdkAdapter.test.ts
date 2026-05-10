/**
 * AgentSdkAdapter (CursorSdkAdapter) unit tests — MT-1 hotfix
 * (TASK-20260510-010-PM-to-DEV §3.5).
 *
 * Background: REPORT-20260510-009-QA-to-PM §五 BUG-SDK-001 surfaced that
 * `Agent.create({ local: { cwd } })` produces a usable agent in `local`
 * runtime mode, but the resulting `agent.send()` rejects with:
 *
 *   Local SDK agents require an explicit model.
 *   Pass model: { id: "..." } to Agent.create() or to send(),
 *   or run this agent in cloud mode.
 *
 * MT-1 fixes this by adding `defaultModel` to `CursorSdkAdapterOptions`
 * and having `create()` / `send()` fall back from `spec.modelId` to
 * `this._opts.defaultModel`. These tests pin the wire-through.
 *
 * Test plan (per PM §3.5):
 *   TS-MODEL-1  defaultModel set, no spec.modelId → Agent.create receives
 *               model: { id: defaultModel }
 *   TS-MODEL-2  spec.modelId set (overrides defaultModel) → Agent.create
 *               receives model: { id: spec.modelId }
 *   TS-MODEL-3  neither set → Agent.create receives no `model` key at all
 *               (caller decides; cloud mode auto-picks, local mode will
 *               throw at send). This regression-guards the non-empty case
 *               from accidentally always emitting model.
 *   TS-MODEL-4  send() inherits the same precedence chain (defaultModel
 *               fallback when spec.modelId is omitted) — verifies that
 *               we wired BOTH create+send paths, not just create.
 *
 * SDK seam: we import `Agent` from `@cursor/sdk` and monkey-patch
 * `Agent.create` / `Agent.resume` for the duration of each test, then
 * restore. This is identical in spirit to `PersistentStore.test.ts`
 * scenario 10's `fs.rename` patching — keeps the test zero-dep and
 * doesn't introduce a DI seam in production code.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { Agent } from "@cursor/sdk";

import { CursorSdkAdapter } from "../AgentSdkAdapter.ts";
import type {
  AgentCreateSpec,
  AgentSendSpec,
} from "../AgentSdkAdapter.ts";

/** A baseline create spec — every test overlays just the field it varies. */
function baseCreateSpec(): AgentCreateSpec {
  return {
    agentId: "DEV-01",
    role: "developer",
    layer: "worker",
    runtime: "local",
    workspace: "/tmp/codeflow-test",
  };
}

function baseSendSpec(): AgentSendSpec {
  return {
    sessionId: "session-test-1",
    agentId: "DEV-01",
    text: "go",
  };
}

/**
 * Patch `Agent.create` to a spy. Returns a `restore()` callback. Captures
 * **only the most recent** call's options (sufficient for these tests —
 * each test does exactly one create).
 */
function patchAgentCreate(): {
  captured: { lastOpts: Record<string, unknown> | null };
  restore: () => void;
} {
  const realCreate = (Agent as unknown as { create: typeof Agent.create })
    .create;
  const captured: { lastOpts: Record<string, unknown> | null } = {
    lastOpts: null,
  };
  (Agent as unknown as { create: unknown }).create = (async (
    opts: Record<string, unknown>,
  ) => {
    captured.lastOpts = opts;
    return {
      agentId: "stub-agent-id-mt1-test",
      [Symbol.asyncDispose]: async () => undefined,
    };
  }) as unknown as typeof Agent.create;
  return {
    captured,
    restore: () => {
      (Agent as unknown as { create: typeof Agent.create }).create = realCreate;
    },
  };
}

/**
 * Sentinel marker used by `patchAgentResumeForSeamTest` — when `agent.send()`
 * is invoked on the stub agent we throw with this exact message so the
 * test can distinguish "resume captured the model option correctly" from
 * "Agent.resume itself failed". CursorSdkAdapter.send() catches this in
 * its non-CursorAgentError path and re-throws it verbatim, so the test
 * uses `assert.rejects(..., /SEAM_TEST_HALT/)` as a positive signal.
 */
const SEAM_TEST_HALT = "SEAM_TEST_HALT_after_capturing_resume_opts";

/**
 * Patch `Agent.resume` to record options. Stops the run-handle construction
 * path by having the stub agent's `.send()` throw the sentinel marker
 * above — that's much cheaper than building a SDKMessage-shaped Run.
 */
function patchAgentResumeForSeamTest(): {
  captured: { lastResumeOpts: Record<string, unknown> | null };
  restore: () => void;
} {
  const realResume = (Agent as unknown as { resume: typeof Agent.resume })
    .resume;
  const captured: { lastResumeOpts: Record<string, unknown> | null } = {
    lastResumeOpts: null,
  };
  (Agent as unknown as { resume: unknown }).resume = (async (
    _id: string,
    opts: Record<string, unknown>,
  ) => {
    captured.lastResumeOpts = opts;
    return {
      send: async (_text: string) => {
        throw new Error(SEAM_TEST_HALT);
      },
      [Symbol.asyncDispose]: async () => undefined,
    };
  }) as unknown as typeof Agent.resume;
  return {
    captured,
    restore: () => {
      (Agent as unknown as { resume: typeof Agent.resume }).resume = realResume;
    },
  };
}

// ───────────── TS-MODEL-1: defaultModel only, no spec.modelId ─────────────

test("TS-MODEL-1: defaultModel set + spec.modelId omitted → Agent.create gets model.id=defaultModel", async () => {
  const { captured, restore } = patchAgentCreate();
  try {
    const adapter = new CursorSdkAdapter({
      apiKey: "fake-key-not-validated-in-stub",
      defaultModel: "claude-sonnet-4",
    });
    await adapter.create(baseCreateSpec());

    assert.ok(captured.lastOpts, "Agent.create must have been called");
    const model = (captured.lastOpts as { model?: { id?: string } }).model;
    assert.deepEqual(
      model,
      { id: "claude-sonnet-4" },
      "model must be filled from adapter-level defaultModel",
    );
  } finally {
    restore();
  }
});

// ───────── TS-MODEL-2: spec.modelId overrides defaultModel ─────────

test("TS-MODEL-2: spec.modelId set (overrides defaultModel) → Agent.create gets model.id=spec.modelId", async () => {
  const { captured, restore } = patchAgentCreate();
  try {
    const adapter = new CursorSdkAdapter({
      apiKey: "fake-key-not-validated-in-stub",
      defaultModel: "claude-sonnet-4",
    });
    const spec = { ...baseCreateSpec(), modelId: "gpt-5" };
    await adapter.create(spec);

    assert.ok(captured.lastOpts);
    const model = (captured.lastOpts as { model?: { id?: string } }).model;
    assert.deepEqual(
      model,
      { id: "gpt-5" },
      "spec.modelId must take precedence over adapter-level defaultModel",
    );
  } finally {
    restore();
  }
});

// ──── TS-MODEL-3: neither set → no `model` key at all (regression guard) ────

test("TS-MODEL-3: defaultModel omitted + spec.modelId omitted → Agent.create called WITHOUT a model key", async () => {
  const { captured, restore } = patchAgentCreate();
  try {
    const adapter = new CursorSdkAdapter({
      apiKey: "fake-key-not-validated-in-stub",
      // intentionally no defaultModel
    });
    await adapter.create(baseCreateSpec());

    assert.ok(captured.lastOpts);
    assert.ok(
      !("model" in captured.lastOpts),
      "Agent.create must receive NO model key (caller decides; cloud auto-picks, local will fail at send)",
    );
  } finally {
    restore();
  }
});

// ──── TS-MODEL-4: send() honors the same precedence chain ────

test("TS-MODEL-4: send() — defaultModel fallback when spec.modelId is omitted", async () => {
  const { captured, restore } = patchAgentResumeForSeamTest();
  try {
    const adapter = new CursorSdkAdapter({
      apiKey: "fake-key-not-validated-in-stub",
      defaultModel: "claude-sonnet-4",
    });
    // The stub agent's `.send()` throws SEAM_TEST_HALT after Agent.resume
    // already captured opts — that's the seam we're testing.
    await assert.rejects(
      () => adapter.send(baseSendSpec(), "stub-sdk-id-mt1-test"),
      new RegExp(SEAM_TEST_HALT),
      "expected stub agent.send() to halt after seam was captured",
    );

    assert.ok(captured.lastResumeOpts, "Agent.resume must have been called");
    const model = (captured.lastResumeOpts as { model?: { id?: string } })
      .model;
    assert.deepEqual(
      model,
      { id: "claude-sonnet-4" },
      "send() must wire defaultModel → Agent.resume({ model }) too, not just create()",
    );
  } finally {
    restore();
  }
});

// ──── TS-MODEL-5: send() spec.modelId override (sanity: same shape on both methods) ────

test("TS-MODEL-5: send() — spec.modelId overrides defaultModel symmetric to create()", async () => {
  const { captured, restore } = patchAgentResumeForSeamTest();
  try {
    const adapter = new CursorSdkAdapter({
      apiKey: "fake-key-not-validated-in-stub",
      defaultModel: "claude-sonnet-4",
    });
    const spec = { ...baseSendSpec(), modelId: "gpt-5" };
    await assert.rejects(
      () => adapter.send(spec, "stub-sdk-id-mt1-test"),
      new RegExp(SEAM_TEST_HALT),
    );

    assert.ok(captured.lastResumeOpts);
    const model = (captured.lastResumeOpts as { model?: { id?: string } })
      .model;
    assert.deepEqual(model, { id: "gpt-5" });
  } finally {
    restore();
  }
});
