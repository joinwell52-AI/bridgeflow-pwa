/**
 * AgentSdkAdapter (CursorSdkAdapter) unit tests.
 *
 * MT-1 (TASK-20260510-010-PM-to-DEV §3.5) — TS-MODEL-1..5 — defaultModel
 * wire-through (BUG-SDK-001 closure).
 *
 * MT-2 (TASK-20260510-012-PM-to-DEV) — TS-RUN-1..2 — `agent.send()` opts
 * carry `local: { force: true }` for local-mode sends and an empty object
 * for cloud-mode sends (BUG-SDK-002 closure).
 *
 * Background:
 *
 * - REPORT-20260510-009-QA-to-PM §五 BUG-SDK-001 surfaced that
 *   `Agent.create({ local: { cwd } })` produces a usable agent in `local`
 *   runtime mode, but the resulting `agent.send()` rejects with:
 *     Local SDK agents require an explicit model. Pass model: { id: "..." }
 *     to Agent.create() or to send(), or run this agent in cloud mode.
 *   MT-1 fixed this by adding `defaultModel` to `CursorSdkAdapterOptions`
 *   and having `create()` / `send()` fall back from `spec.modelId` to
 *   `this._opts.defaultModel`. TS-MODEL-1..5 pin the wire-through.
 *
 * - REPORT-20260510-011-QA-to-PM §六 BUG-SDK-002 surfaced that, after
 *   MT-1's model wire-through, the very next failure is:
 *     Agent <uuid> already has active run (code=undefined, isRetryable=false)
 *   100% reproducible across two independent runs (different dataDir +
 *   different agent UUID). MT-2 fixes this by passing
 *   `local: { force: true }` to `agent.send()` for local-mode sends — see
 *   AgentSdkAdapter.ts file-level JSDoc for the root-cause analysis.
 *   TS-RUN-1..2 pin the new send-opts shape (local vs cloud).
 *
 * Test plan:
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
 *   TS-MODEL-5  send() spec.modelId override symmetric to create().
 *   TS-RUN-1    local-mode send → agent.send(text, { local: { force: true } }).
 *               This is the BUG-SDK-002 fix — without `force` the SDK
 *               rejects every local send after a `create()` because the
 *               first `create()` leaves a persisted run wedged on disk.
 *   TS-RUN-2    cloud-mode send → agent.send(text, {}).
 *               No `local` field is allowed on cloud sends per SDK type
 *               system; cloud uses server-side `409 agent_busy` instead.
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
 *
 * Also captures the second argument to `agent.send(text, opts)` so MT-2
 * tests (TS-RUN-1..2) can assert on the SendOptions shape.
 */
function patchAgentResumeForSeamTest(): {
  captured: {
    lastResumeOpts: Record<string, unknown> | null;
    lastSendText: string | null;
    lastSendOpts: Record<string, unknown> | null;
    sendCallCount: number;
  };
  restore: () => void;
} {
  const realResume = (Agent as unknown as { resume: typeof Agent.resume })
    .resume;
  const captured = {
    lastResumeOpts: null as Record<string, unknown> | null,
    lastSendText: null as string | null,
    lastSendOpts: null as Record<string, unknown> | null,
    sendCallCount: 0,
  };
  (Agent as unknown as { resume: unknown }).resume = (async (
    _id: string,
    opts: Record<string, unknown>,
  ) => {
    captured.lastResumeOpts = opts;
    return {
      send: async (
        text: string,
        sendOpts?: Record<string, unknown>,
      ) => {
        captured.lastSendText = text;
        captured.lastSendOpts = sendOpts ?? null;
        captured.sendCallCount += 1;
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

// ─────── TS-RUN-1: local mode send → agent.send(text, { local: { force: true } }) ───────
//
// BUG-SDK-002 fix verification: every local-mode `agent.send()` from
// CursorSdkAdapter must carry `local: { force: true }` so that the SDK's
// "expire-then-replace" recovery path runs (vs. "this is a 2nd run on the
// same agent" rejection). See AgentSdkAdapter.ts file-level JSDoc.

test("TS-RUN-1: local-mode send → agent.send is called with { local: { force: true } }", async () => {
  const { captured, restore } = patchAgentResumeForSeamTest();
  try {
    const adapter = new CursorSdkAdapter({
      apiKey: "fake-key-not-validated-in-stub",
      defaultModel: "claude-sonnet-4",
      // local is the v0.2 default; spelled out here for self-documentation.
      listScope: "local",
    });
    await assert.rejects(
      () => adapter.send(baseSendSpec(), "stub-sdk-id-bug-sdk-002-test"),
      new RegExp(SEAM_TEST_HALT),
      "expected stub agent.send() to halt after seam was captured",
    );

    assert.equal(
      captured.sendCallCount,
      1,
      "agent.send() must be called exactly once (no retry path on seam halt)",
    );
    assert.equal(captured.lastSendText, "go", "text must round-trip from spec");
    assert.deepEqual(
      captured.lastSendOpts,
      { local: { force: true } },
      "BUG-SDK-002: local-mode sends MUST set local.force=true to expire any " +
        "wedged persisted run before starting a new one",
    );
  } finally {
    restore();
  }
});

// ─────── TS-RUN-2: cloud mode send → agent.send(text, {}) (no local field) ───────
//
// SendOptions.local is type-gated to local agents in @cursor/sdk
// (`local?: { ... }` only exists in the local-shape variant). Cloud sends
// must send an EMPTY options object — cloud has server-side `409 agent_busy`
// concurrency control, so no equivalent of `force` exists or is needed.

test("TS-RUN-2: cloud-mode send → agent.send is called with empty SendOptions (no local field)", async () => {
  const { captured, restore } = patchAgentResumeForSeamTest();
  try {
    const adapter = new CursorSdkAdapter({
      apiKey: "fake-key-not-validated-in-stub",
      defaultModel: "claude-sonnet-4",
      listScope: "cloud",
    });
    await assert.rejects(
      () => adapter.send(baseSendSpec(), "stub-sdk-id-cloud-test"),
      new RegExp(SEAM_TEST_HALT),
    );

    assert.equal(captured.sendCallCount, 1);
    assert.deepEqual(
      captured.lastSendOpts,
      {},
      "cloud-mode sends MUST omit `local` (SDK type system rejects it; " +
        "cloud has server-side 409 agent_busy concurrency control instead)",
    );
  } finally {
    restore();
  }
});
