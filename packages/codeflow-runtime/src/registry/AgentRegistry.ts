/**
 * AgentRegistry — the runtime's PCB table (process-control-block table).
 *
 * Owns the question "which agents exist, what are their bindings, what's
 * their status". Wraps SDK `Agent.create` / `Agent.resume` (S3 will land
 * the actual SDK calls; S2 only fixes the contract).
 *
 * Reference:
 * - design doc `docs/design/codeflow-v2-on-fcop-sdk.md` §2.1 subsystem 3,
 *   §3.2 Agent Schema, §0.9.1 layer enforcement
 * - dispatched from `docs/agents/tasks/TASK-20260509-002-PM-to-DEV.md`
 */

import type { Agent, AgentLayer } from "@codeflow/protocol";
import type {
  AgentRecord,
  RuntimeBindingMode,
} from "../types/state.ts";
import type { PersistentStore } from "./PersistentStore.ts";

/** Filter passed to `AgentRegistry.list`. All fields optional and AND-combined. */
export interface AgentRegistryFilter {
  layer?: AgentLayer;
  role?: string;
  /** Matches `Agent.status` from `@codeflow/protocol`. */
  status?: Agent["status"];
}

/**
 * Constructor options for the AgentRegistry. All concrete wiring lives here
 * so the registry itself is dependency-free.
 *
 * S3 will add: SDK client, agentId-generator, fsync-policy, etc.
 */
export interface AgentRegistryOptions {
  store: PersistentStore;
}

/**
 * AgentRegistry — central directory of agent instances.
 *
 * Lifecycle:
 *
 * 1. `register(spec)` → SDK `Agent.create()` + write to `agents.json` (PCB).
 * 2. `resume(agentId)` → SDK `Agent.resume()` + reconcile bookkeeping.
 *    Used at runtime startup to recover from a crash (`docs/crash-recovery.md`).
 * 3. `list(filter)` → in-memory query, never hits SDK.
 * 4. `get(agentId)` → in-memory query, returns `null` if absent.
 * 5. `updateRuntimeBinding(agentId, mode)` → swap local↔cloud, triggers
 *    auto-resume on the new node.
 * 6. `markFailed(agentId, reason)` → put agent into terminal `error` state.
 *
 * Invariants enforced at this layer (NOT delegated to SDK):
 *
 * - `register({ layer: "admin" })` MUST throw — admin agents are spawned
 *   by the human ADMIN entry only, never by the runtime. (§0.9.1 + §3.2)
 * - Every record MUST include `"fcop"` in `skills[]` (kernel dependency,
 *   §3.2 schema-level constraint, double-checked here for fast-fail).
 * - `agent_id` uniqueness is owned by this class — duplicate `register`
 *   throws; no silent overwrite.
 *
 * S2 STATE: every method below throws `Error("[S2 skeleton] ...")`. The
 * shapes are frozen for S3 to fill in.
 */
export class AgentRegistry {
  // Prefixed `_` to silence unused-private-field lints in S2 skeleton.
  // S3 will reference this in every method body.
  private readonly _store: PersistentStore;

  constructor(opts: AgentRegistryOptions) {
    this._store = opts.store;
  }

  /**
   * First-time creation of an agent.
   *
   * @param agentSpec — protocol-level Agent description from `roles.yaml`.
   *   Will be validated against `@codeflow/protocol` schema before SDK call.
   * @returns the persisted AgentRecord with `sdk_agent_id` populated.
   *
   * @throws `Error` if `agentSpec.layer === "admin"` (admin agents are not
   *   spawnable via the runtime; ADMIN entry is the only legitimate spawner).
   * @throws `Error` if an agent with the same `agent_id` already exists
   *   (caller should `resume` instead of `register`).
   * @throws `Error` if `agentSpec.skills` does not contain `"fcop"` (kernel
   *   dependency, see §0.6.5 + §3.2 schema constraint `contains: { const: "fcop" }`).
   * @throws `Error` if SDK `Agent.create()` fails — agents.json is NOT
   *   modified in this case (write is gated on SDK success).
   */
  async register(agentSpec: Agent): Promise<AgentRecord> {
    void agentSpec;
    throw new Error(
      "[S2 skeleton] AgentRegistry.register not implemented — see TASK-20260509-002 §必交付 2; lands in S3.",
    );
  }

  /**
   * Re-bind to an SDK agent that already exists (typically after a runtime
   * crash). Reads `agents.json` for the bookkeeping fields and calls SDK
   * `Agent.resume(sdk_agent_id)` to re-establish the live binding.
   *
   * @param agentId — the FCoP-level `agent_id` (e.g. `"DEV-01"`), NOT the SDK
   *   `sdk_agent_id`. Internal lookup translates one to the other.
   * @returns the AgentRecord with `runtime_last_reconciled_at` updated to now.
   *
   * @throws `Error` if `agents.json` does not contain `agentId`.
   * @throws `Error` if SDK `Agent.resume()` fails with an unrecoverable error
   *   (e.g. `sdk_agent_id` was deleted upstream). In this case, agents.json
   *   is NOT corrupted — the failed resume is logged and the record is
   *   marked `status: "error"` via `markFailed()` for the caller's next read.
   */
  async resume(agentId: string): Promise<AgentRecord> {
    void agentId;
    throw new Error(
      "[S2 skeleton] AgentRegistry.resume not implemented — see TASK-20260509-002 §必交付 2; lands in S3.",
    );
  }

  /**
   * Query the in-memory PCB. Never hits the SDK.
   *
   * @param filter — optional filter. If omitted or empty, returns ALL records.
   *   Multiple filter fields are AND-combined.
   * @returns array, possibly empty.
   *
   * @throws never (read-only operation; if store is corrupt, the error
   *   surfaces at startup, not here).
   */
  async list(filter?: AgentRegistryFilter): Promise<AgentRecord[]> {
    void filter;
    throw new Error(
      "[S2 skeleton] AgentRegistry.list not implemented — see TASK-20260509-002 §必交付 2; lands in S3.",
    );
  }

  /**
   * Single-record lookup by `agent_id`.
   *
   * @param agentId — FCoP-level role id (e.g. `"DEV-01"`).
   * @returns the record, or `null` if no such agent. Does NOT throw on
   *   missing — that's a normal flow signal for "not registered yet".
   *
   * @throws never.
   */
  async get(agentId: string): Promise<AgentRecord | null> {
    void agentId;
    throw new Error(
      "[S2 skeleton] AgentRegistry.get not implemented — see TASK-20260509-002 §必交付 2; lands in S3.",
    );
  }

  /**
   * Switch the runtime binding mode (local ↔ cloud) for an existing agent.
   * Triggers an automatic `resume` on the new node.
   *
   * @param agentId — FCoP-level role id.
   * @param runtime — target binding mode.
   *
   * @throws `Error` if `agentId` is not registered.
   * @throws `Error` if the new binding fails (agent stays on old binding;
   *   record's `runtime_failure` is set with the reason).
   *
   * Cross-link: §0.7.4 three-node distributed runtime.
   */
  async updateRuntimeBinding(
    agentId: string,
    runtime: RuntimeBindingMode,
  ): Promise<void> {
    void agentId;
    void runtime;
    throw new Error(
      "[S2 skeleton] AgentRegistry.updateRuntimeBinding not implemented — see TASK-20260509-002 §必交付 2; lands in S3.",
    );
  }

  /**
   * Mark an agent as failed. Sets `protocol.status = "error"` and records
   * `runtime_failure` for diagnostics. A failed agent CANNOT receive new
   * `send()` calls until explicitly reset (S5+ feature).
   *
   * @param agentId — FCoP-level role id.
   * @param error — human-readable failure reason. Stored verbatim in
   *   `runtime_failure.reason`.
   *
   * @throws `Error` if `agentId` is not registered.
   * @throws never on the storage side (best-effort persist; failure to
   *   persist is logged but does not propagate, because we'd otherwise
   *   lose the failure signal entirely).
   */
  async markFailed(agentId: string, error: string): Promise<void> {
    void agentId;
    void error;
    throw new Error(
      "[S2 skeleton] AgentRegistry.markFailed not implemented — see TASK-20260509-002 §必交付 2; lands in S3.",
    );
  }
}
