/**
 * AgentRegistry — the runtime's PCB table (process-control-block table).
 *
 * Sprint S2 shipped JSDoc-only skeletons that threw `not-implemented`.
 * Sprint S3 Phase A (this file) lands the 6 method bodies, wiring:
 *
 *   - ajv schema validation (via `@codeflow/protocol`) for every write
 *   - `AgentSdkAdapter` for SDK side effects (testable via InMemory adapter)
 *   - `PersistentStore` for atomic-write durability (decision 1)
 *   - layer=admin gating BEFORE any SDK call (TASK-009 §必交付 2 invariant)
 *   - `_isBootstrapping` race-defense flag for `RuntimeBootstrap` (decision 2)
 *
 * Reference:
 * - design doc `docs/design/codeflow-v2-on-fcop-sdk.md` §2.1 subsystem 3,
 *   §3.2 Agent Schema, §0.9.1 layer enforcement
 * - `docs/agents/tasks/TASK-20260509-009-PM-to-DEV.md` §必交付 2
 * - `docs/crash-recovery.md` decision 1 (write timing) + decision 2
 *   (RuntimeNotReady race-defense)
 */

import { validate as validateAgainstSchema } from "@codeflow/protocol";
import type { Agent, AgentLayer } from "@codeflow/protocol";

import type {
  AgentRecord,
  RuntimeBindingMode,
} from "../types/state.ts";
import type { AgentSdkAdapter } from "./AgentSdkAdapter.ts";
import type { PersistentStore } from "./PersistentStore.ts";
import {
  AgentNotFoundError,
  LayerViolationError,
  RuntimeNotReadyError,
  ValidationError,
} from "./errors.ts";

/** Filter passed to `AgentRegistry.list`. All fields optional and AND-combined. */
export interface AgentRegistryFilter {
  layer?: AgentLayer;
  role?: string;
  /** Matches `Agent.status` from `@codeflow/protocol`. */
  status?: Agent["status"];
}

/**
 * Constructor options for the AgentRegistry. Concrete wiring lives in
 * the caller's composition root so the registry itself stays
 * dependency-free.
 */
export interface AgentRegistryOptions {
  store: PersistentStore;
  sdk: AgentSdkAdapter;
}

/**
 * AgentRegistry — central directory of agent instances.
 *
 * Lifecycle (Phase A complete):
 *
 * 1. `register(spec)` → schema validate → SDK `create` → write `agents.json`.
 * 2. `resume(agentId)` → SDK `resume` + bookkeeping update.
 * 3. `list(filter)` → in-memory query, never hits SDK.
 * 4. `get(agentId)` → in-memory query, returns `null` if absent.
 * 5. `updateRuntimeBinding(agentId, mode)` → swap local↔cloud (no automatic
 *    resume; caller drives that explicitly to keep side effects boxed).
 * 6. `markFailed(agentId, reason)` → put agent into terminal `error` state.
 *
 * Invariants enforced HERE (NOT delegated to SDK):
 *
 * - `register({ layer: "admin" })` throws `LayerViolationError` BEFORE
 *   the SDK is touched (§0.9.1 + §3.2).
 * - Every `agentSpec` write is ajv-validated against `@codeflow/protocol`
 *   `agent` schema before persistence (TASK-009 invariant).
 * - During `RuntimeBootstrap.run()`, `register` throws `RuntimeNotReadyError`
 *   (race-defense per crash-recovery.md decision 2).
 * - `agents.json` write failures roll back atomically — `JsonFileStore`'s
 *   write-temp + rename means no partial state ever exists (decision 1).
 */
export class AgentRegistry {
  private readonly _store: PersistentStore;
  private readonly _sdk: AgentSdkAdapter;
  private _isBootstrapping = false;

  constructor(opts: AgentRegistryOptions) {
    this._store = opts.store;
    this._sdk = opts.sdk;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Bootstrap race-defense (used by RuntimeBootstrap)
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Mark the registry as bootstrapping; reject `register` until cleared.
   * Called only by `RuntimeBootstrap` — left package-private via naming
   * convention rather than a TS access modifier so RuntimeBootstrap (in
   * the same package) can call it without breaking the public API.
   *
   * @internal
   */
  _setBootstrapping(value: boolean): void {
    this._isBootstrapping = value;
  }

  /** Read-only probe of the bootstrapping flag. Used by tests. */
  get isBootstrapping(): boolean {
    return this._isBootstrapping;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────

  /**
   * First-time creation of an agent.
   *
   * @param agentSpec — protocol-level Agent description from `roles.yaml`.
   *   Validated against `@codeflow/protocol` `agent` schema before SDK call.
   * @returns the persisted AgentRecord with `sdk_agent_id` populated.
   *
   * @throws `RuntimeNotReadyError` if `RuntimeBootstrap.run()` is in progress.
   * @throws `ValidationError` if `agentSpec` fails schema validation.
   * @throws `LayerViolationError` if `agentSpec.layer === "admin"` (admin
   *   agents are not spawnable via the runtime; ADMIN entry only).
   * @throws `Error` (verbatim from SDK adapter) if SDK `create` fails —
   *   `agents.json` is NOT modified in that case.
   */
  async register(agentSpec: Agent): Promise<AgentRecord> {
    if (this._isBootstrapping) {
      throw new RuntimeNotReadyError();
    }

    // Layer-admin check happens BEFORE schema validation: it's a
    // governance-level reject that doesn't depend on the rest of the
    // shape being well-formed. (Test scenario 3 requires SDK adapter
    // is NOT touched in this path — verifying via spy.)
    if (agentSpec.layer === "admin") {
      throw new LayerViolationError("admin");
    }

    const result = await validateAgainstSchema("agent", agentSpec);
    if (!result.valid) {
      throw new ValidationError(
        `agentSpec failed @codeflow/protocol agent schema (${result.errors?.length ?? 0} error(s))`,
        result.errors ?? [],
      );
    }

    // SDK adapter call — if it throws, agents.json is untouched (we
    // haven't called the store yet).
    const { sdk_agent_id } = await this._sdk.create({
      agentId: agentSpec.agent_id,
      role: agentSpec.role,
      layer: agentSpec.layer,
      runtime: agentSpec.runtime,
      ...(agentSpec.workspace !== undefined
        ? { workspace: agentSpec.workspace }
        : {}),
      ...(agentSpec.model?.id !== undefined
        ? { modelId: agentSpec.model.id }
        : {}),
    });

    const now = new Date().toISOString();
    const record: AgentRecord = {
      protocol: {
        ...agentSpec,
        sdk_agent_id,
        status: "idle",
        ...(agentSpec.started_at ? {} : { started_at: now }),
        last_active_at: now,
      },
      runtime_binding_mode: agentSpec.runtime,
      runtime_last_reconciled_at: now,
    };

    await this._store.upsert(record);
    return record;
  }

  /**
   * Re-bind to an SDK agent that already exists (typically after a
   * runtime crash). Reads `agents.json` for the bookkeeping fields and
   * calls SDK `resume(sdk_agent_id)` to re-establish the live binding.
   *
   * @param agentId — the FCoP-level `agent_id` (e.g. `"DEV-01"`), NOT
   *   the SDK `sdk_agent_id`. Internal lookup translates one to the other.
   * @returns the AgentRecord with `runtime_last_reconciled_at` updated to now.
   *
   * @throws `AgentNotFoundError` if `agents.json` does not contain `agentId`.
   * @throws `Error` (verbatim from SDK adapter) if `resume` fails. The
   *   record is NOT modified in this case — the caller may follow up
   *   with `markFailed()` if they want to record the failure.
   */
  async resume(agentId: string): Promise<AgentRecord> {
    const record = await this._loadOrThrow(agentId);
    if (!record.protocol.sdk_agent_id) {
      throw new AgentNotFoundError(
        `${agentId} (record exists but has no sdk_agent_id; was it ever registered?)`,
      );
    }

    try {
      await this._sdk.resume(record.protocol.sdk_agent_id);
    } catch (err) {
      // Re-throw with context but preserve original error class (instanceof
      // checks in tests still work via cause chain).
      const message =
        err instanceof Error ? err.message : String(err);
      throw new Error(
        `Agent.resume failed for sdk_agent_id="${record.protocol.sdk_agent_id}" (agent_id="${agentId}"): ${message}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { cause: err } as any,
      );
    }

    const now = new Date().toISOString();
    const updated: AgentRecord = {
      ...record,
      protocol: {
        ...record.protocol,
        last_active_at: now,
      },
      runtime_last_reconciled_at: now,
    };
    await this._store.upsert(updated);
    return updated;
  }

  /**
   * Query the in-memory PCB. Never hits the SDK.
   *
   * @param filter — optional filter. If omitted or empty, returns ALL records.
   *   Multiple filter fields are AND-combined.
   * @returns array, possibly empty.
   */
  async list(filter?: AgentRegistryFilter): Promise<AgentRecord[]> {
    const records = await this._store.loadAll();
    if (!filter) return records;

    return records.filter((r) => {
      if (filter.layer !== undefined && r.protocol.layer !== filter.layer) {
        return false;
      }
      if (filter.role !== undefined && r.protocol.role !== filter.role) {
        return false;
      }
      if (filter.status !== undefined && r.protocol.status !== filter.status) {
        return false;
      }
      return true;
    });
  }

  /**
   * Single-record lookup by `agent_id`.
   *
   * @returns the record, or `null` if no such agent. Does NOT throw on
   *   missing — that's a normal flow signal for "not registered yet".
   */
  async get(agentId: string): Promise<AgentRecord | null> {
    const records = await this._store.loadAll();
    return records.find((r) => r.protocol.agent_id === agentId) ?? null;
  }

  /**
   * Switch the runtime binding mode (local ↔ cloud) for an existing agent.
   *
   * **Phase A behavior**: this method ONLY updates the persisted binding
   * mode. It does NOT call `resume` to migrate the SDK agent. The caller
   * must invoke `registry.resume(agentId)` explicitly if they want the
   * SDK side to follow the binding swap. Rationale: avoid implicit
   * side-effect chains; let `RuntimeBootstrap` and the operator stay
   * in charge of when SDK calls happen.
   *
   * @throws `AgentNotFoundError` if `agentId` is not registered.
   *
   * Cross-link: §0.7.4 three-node distributed runtime.
   */
  async updateRuntimeBinding(
    agentId: string,
    runtime: RuntimeBindingMode,
  ): Promise<void> {
    const record = await this._loadOrThrow(agentId);
    if (record.runtime_binding_mode === runtime) return; // no-op

    const updated: AgentRecord = {
      ...record,
      runtime_binding_mode: runtime,
      protocol: {
        ...record.protocol,
        runtime,
      },
    };
    await this._store.upsert(updated);
  }

  /**
   * Mark an agent as failed. Sets `status = "error"` and records
   * `runtime_failure` for diagnostics.
   *
   * @throws `AgentNotFoundError` if `agentId` is not registered.
   */
  async markFailed(agentId: string, error: string): Promise<void> {
    const record = await this._loadOrThrow(agentId);
    const failed_at = new Date().toISOString();
    const updated: AgentRecord = {
      ...record,
      protocol: {
        ...record.protocol,
        status: "error",
        last_active_at: failed_at,
      },
      runtime_failure: {
        failed_at,
        reason: error,
      },
    };
    await this._store.upsert(updated);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────────────────

  private async _loadOrThrow(agentId: string): Promise<AgentRecord> {
    const records = await this._store.loadAll();
    const record = records.find((r) => r.protocol.agent_id === agentId);
    if (!record) throw new AgentNotFoundError(agentId);
    return record;
  }
}
