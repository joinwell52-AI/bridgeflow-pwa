/**
 * AgentRegistry unit tests — TASK-20260509-009 §必交付 6 scenarios 1-6.
 *
 * Run with `npm test` (which invokes `node --import tsx --test`).
 *
 * Scenario coverage:
 *   1. register normal flow
 *   2. register schema validation failure (missing layer)
 *   3. register layer=admin → SDK adapter NOT touched (spy-verified)
 *   4. register SDK create throws → agents.json untouched
 *   5. resume happy path → record updated
 *   6. resume target missing → AgentNotFoundError
 */

import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import type { Agent } from "@codeflow/protocol";

import { AgentRegistry } from "../AgentRegistry.ts";
import {
  AgentNotFoundError,
  LayerViolationError,
  ValidationError,
} from "../errors.ts";
import { InMemorySdkAdapter } from "../AgentSdkAdapter.ts";

import { captureLogger, validAgentSpec, withTempStore } from "./helpers.ts";

void captureLogger; // imported for symmetry with bootstrap tests; not used here

// Scenario 1
test("register: normal flow persists record + sets sdk_agent_id", async () => {
  await withTempStore(async ({ store, agentsPath }) => {
    const sdk = new InMemorySdkAdapter();
    const registry = new AgentRegistry({ store, sdk });

    const record = await registry.register(validAgentSpec());

    assert.equal(record.protocol.agent_id, "DEV-01");
    assert.match(record.protocol.sdk_agent_id ?? "", /^sdk-fake-/);
    assert.equal(record.protocol.status, "idle");
    assert.equal(record.runtime_binding_mode, "local");
    assert.ok(record.runtime_last_reconciled_at);

    assert.ok(existsSync(agentsPath), "agents.json must exist after register");
    const persisted = JSON.parse(readFileSync(agentsPath, "utf-8"));
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].protocol.agent_id, "DEV-01");
    assert.equal(persisted[0].protocol.sdk_agent_id, record.protocol.sdk_agent_id);

    assert.equal(sdk.calls.create.length, 1);
    assert.equal(sdk.calls.create[0]?.agentId, "DEV-01");
  });
});

// Scenario 2
test("register: schema validation rejects missing layer", async () => {
  await withTempStore(async ({ store, agentsPath }) => {
    const sdk = new InMemorySdkAdapter();
    const registry = new AgentRegistry({ store, sdk });

    const bogus = {
      agent_id: "DEV-01",
      role: "developer",
      // layer intentionally missing
      node: "local",
      runtime: "local",
      skills: ["fcop"],
      status: "idle",
    } as unknown as Agent;

    await assert.rejects(() => registry.register(bogus), ValidationError);
    assert.equal(
      sdk.calls.create.length,
      0,
      "SDK adapter must not be called when validation fails",
    );
    assert.equal(
      existsSync(agentsPath),
      false,
      "agents.json must not be created on validation failure",
    );
  });
});

// Scenario 3 — the BIG invariant: layer=admin reject BEFORE SDK call
test("register: layer=admin throws LayerViolationError before SDK is touched", async () => {
  await withTempStore(async ({ store, agentsPath }) => {
    const sdk = new InMemorySdkAdapter();
    const registry = new AgentRegistry({ store, sdk });

    const adminSpec = validAgentSpec({
      agent_id: "ADMIN-01",
      role: "admin",
      layer: "admin",
    });

    await assert.rejects(
      () => registry.register(adminSpec),
      LayerViolationError,
    );
    assert.equal(
      sdk.calls.create.length,
      0,
      "SDK adapter MUST NOT be called for layer=admin (test scenario 3 spy)",
    );
    assert.equal(existsSync(agentsPath), false);
  });
});

// Scenario 4 — SDK throws → agents.json never written
test("register: SDK create throws → agents.json is not written", async () => {
  await withTempStore(async ({ store, agentsPath }) => {
    const sdk = new InMemorySdkAdapter();
    sdk.failNextCreateWith("simulated SDK outage");

    const registry = new AgentRegistry({ store, sdk });

    await assert.rejects(() => registry.register(validAgentSpec()));
    assert.equal(
      sdk.calls.create.length,
      1,
      "SDK was hit (expected) — that's how we know we got past validation",
    );
    assert.equal(
      existsSync(agentsPath),
      false,
      "agents.json must NOT exist when SDK create failed",
    );
  });
});

// Scenario 5 — resume happy path
test("resume: SDK knows the id → record's reconciled_at is updated", async () => {
  await withTempStore(async ({ store }) => {
    const sdk = new InMemorySdkAdapter();
    const registry = new AgentRegistry({ store, sdk });

    const original = await registry.register(validAgentSpec());
    const sdkAgentId = original.protocol.sdk_agent_id!;
    const beforeReconciled = original.runtime_last_reconciled_at!;

    // Make sure timestamp moves forward.
    await new Promise((r) => setTimeout(r, 10));

    const resumed = await registry.resume("DEV-01");
    assert.equal(resumed.protocol.agent_id, "DEV-01");
    assert.notEqual(
      resumed.runtime_last_reconciled_at,
      beforeReconciled,
      "runtime_last_reconciled_at must move forward after resume",
    );
    assert.deepEqual(sdk.calls.resume, [sdkAgentId]);
  });
});

// Scenario 6 — resume non-existent agent
test("resume: agent not in store → AgentNotFoundError", async () => {
  await withTempStore(async ({ store }) => {
    const sdk = new InMemorySdkAdapter();
    const registry = new AgentRegistry({ store, sdk });

    await assert.rejects(
      () => registry.resume("DEV-01"),
      AgentNotFoundError,
    );
    assert.equal(sdk.calls.resume.length, 0);
  });
});
