/**
 * AgentSdkAdapter — narrow seam between AgentRegistry and `@cursor/sdk`.
 *
 * Why an adapter at all:
 *
 * - `AgentRegistry` and `RuntimeBootstrap` need three SDK calls:
 *   `create`, `resume`, `list`. Anything else (send / cancel / artifacts)
 *   is outside the registry's contract — handled by `SessionManager` (S3
 *   Phase B+).
 * - Tests must run without a real `CURSOR_API_KEY` / network. The adapter
 *   abstraction lets us inject `InMemorySdkAdapter` so 11 unit-test
 *   scenarios (TASK-009 §必交付 6) cover behavior without touching SDK.
 * - The adapter is the ONLY place that imports `@cursor/sdk` types — keeps
 *   the registry / bootstrap files SDK-version-agnostic.
 *
 * Cross-link: `_ignore/spike_sdk_doorbell/sender.ts` validated the SDK
 * surface used here (Agent.create/resume/list signatures + asyncDispose).
 * Reproduced inline (NOT git-mv'd; spike folder is preserved as historical
 * evidence per HANDOFF + REPORT-002).
 */

import { Agent, CursorAgentError } from "@cursor/sdk";
import type { ListAgentsOptions } from "@cursor/sdk";

import type { AgentLayer, AgentRuntime } from "@codeflow/protocol";

/**
 * Spec used to call `Agent.create()`. Mirrors what `AgentRegistry.register`
 * extracts from a protocol-level `Agent`: enough to bootstrap an SDK agent
 * but not the whole FCoP record (avoids leaking governance fields into
 * SDK tooling that doesn't understand them).
 */
export interface AgentCreateSpec {
  /** FCoP role id, e.g. `"DEV-01"`. Used as the SDK agent's display name. */
  agentId: string;
  /** Mapped to `roles.yaml` `roles[].id`. Used for the role brief. */
  role: string;
  /** §0.9.1 layer; informs the SDK display name only. */
  layer: AgentLayer;
  /** Cursor SDK runtime mode. Currently `local` is the v0.1 reality. */
  runtime: AgentRuntime;
  /** For local agents: cwd path. For cloud agents: repo URL. */
  workspace?: string;
  /** Optional model hint forwarded to `Agent.create({ model })`. */
  modelId?: string;
}

/**
 * Adapter contract — three methods, all narrow on purpose. Implementations
 * MUST be safe to call concurrently for `list`, but `create` / `resume`
 * may serialize at the implementation's discretion (the SDK already
 * enforces `409 agent_busy` server-side).
 */
export interface AgentSdkAdapter {
  /**
   * Create an SDK agent and return its (cloud or local) `agentId`.
   * Mirrors `Agent.create({...})` — the registry takes the returned id
   * verbatim and stores it as `record.protocol.sdk_agent_id`.
   */
  create(spec: AgentCreateSpec): Promise<{ sdk_agent_id: string }>;

  /**
   * Enumerate `sdk_agent_id`s currently visible to the SDK. Used by
   * `RuntimeBootstrap` to detect orphaned / foreign records.
   *
   * Implementations MAY filter by runtime/cwd; `RuntimeBootstrap` calls
   * with the runtime's configured cwd to scope local-runtime listings.
   */
  list(): Promise<string[]>;

  /**
   * Re-bind to an existing SDK agent. Equivalent to `Agent.resume(id)`,
   * but adapter-shaped so tests don't need a real SDK.
   *
   * MUST throw if the SDK no longer recognizes the id; callers translate
   * that into the `orphan_local` reconciliation strategy.
   */
  resume(sdkAgentId: string): Promise<void>;
}

// ───────────────────────────────────────────────────────────────────────────
// Cursor SDK-backed implementation
// ───────────────────────────────────────────────────────────────────────────

/** Construction options for `CursorSdkAdapter`. */
export interface CursorSdkAdapterOptions {
  /**
   * `CURSOR_API_KEY` to forward to every SDK call. Falls back to
   * `process.env.CURSOR_API_KEY` at call time if omitted.
   */
  apiKey?: string;
  /**
   * Default cwd for local-runtime agents. Tests override this; production
   * uses the runtime's working directory.
   */
  defaultCwd?: string;
  /**
   * `runtime` filter passed to `Agent.list()`. Defaults to `local` to
   * scope reconciliation to the current machine. Set to `undefined` for
   * a cross-runtime listing (rarely useful; only the runtime owner knows
   * which scope is correct).
   */
  listScope?: "local" | "cloud" | undefined;
}

/**
 * Real `@cursor/sdk` adapter. Thin wrapper — no caching, no retries.
 * The registry layer owns retry / failure semantics so they're observable
 * in the same place.
 */
export class CursorSdkAdapter implements AgentSdkAdapter {
  private readonly _opts: CursorSdkAdapterOptions;

  constructor(opts: CursorSdkAdapterOptions = {}) {
    this._opts = opts;
  }

  async create(spec: AgentCreateSpec): Promise<{ sdk_agent_id: string }> {
    const apiKey = this._resolveApiKey();

    let agent;
    try {
      agent = await Agent.create({
        apiKey,
        name: `CodeFlow ${spec.agentId}`,
        ...(spec.modelId ? { model: { id: spec.modelId } } : {}),
        local: { cwd: spec.workspace ?? this._opts.defaultCwd ?? process.cwd() },
      });
    } catch (err) {
      if (err instanceof CursorAgentError) {
        throw new Error(
          `Agent.create failed for agent_id="${spec.agentId}": ${err.message} ` +
            `(code=${err.code}, isRetryable=${err.isRetryable})`,
        );
      }
      throw err;
    }

    const sdkAgentId = agent.agentId;
    await agent[Symbol.asyncDispose]();
    return { sdk_agent_id: sdkAgentId };
  }

  async list(): Promise<string[]> {
    const apiKey = this._resolveApiKey();
    const listOptions = this._buildListOptions(apiKey);

    let result;
    try {
      result = await Agent.list(listOptions);
    } catch (err) {
      if (err instanceof CursorAgentError) {
        throw new Error(
          `Agent.list failed: ${err.message} (code=${err.code}, isRetryable=${err.isRetryable})`,
        );
      }
      throw err;
    }
    return result.items.map((item) => item.agentId);
  }

  async resume(sdkAgentId: string): Promise<void> {
    const apiKey = this._resolveApiKey();
    let agent;
    try {
      agent = await Agent.resume(sdkAgentId, {
        apiKey,
        local: { cwd: this._opts.defaultCwd ?? process.cwd() },
      });
    } catch (err) {
      if (err instanceof CursorAgentError) {
        throw new Error(
          `Agent.resume failed for sdk_agent_id="${sdkAgentId}": ${err.message} ` +
            `(code=${err.code}, isRetryable=${err.isRetryable})`,
        );
      }
      throw err;
    }
    await agent[Symbol.asyncDispose]();
  }

  private _resolveApiKey(): string {
    const apiKey = this._opts.apiKey ?? process.env["CURSOR_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "CursorSdkAdapter: missing CURSOR_API_KEY (set process.env.CURSOR_API_KEY or pass apiKey in constructor)",
      );
    }
    return apiKey;
  }

  private _buildListOptions(apiKey: string): ListAgentsOptions {
    if (this._opts.listScope === "cloud") {
      return { runtime: "cloud", apiKey };
    }
    if (this._opts.listScope === "local") {
      return {
        runtime: "local",
        cwd: this._opts.defaultCwd ?? process.cwd(),
      };
    }
    return {};
  }
}

// ───────────────────────────────────────────────────────────────────────────
// In-memory test double
// ───────────────────────────────────────────────────────────────────────────

/**
 * Thrown by `InMemorySdkAdapter` when a planted error fires during
 * `create` / `resume`. Tests use this class identity to assert that the
 * SDK call was the one that threw (vs. a registry-level validation).
 */
export class InMemorySdkPlantedError extends Error {
  override readonly name = "InMemorySdkPlantedError";
}

/**
 * In-memory `AgentSdkAdapter` for tests. Records every call so `assert.deepEqual`
 * can compare the exact spy trace, and supports planting failures to exercise
 * registry / bootstrap error paths.
 *
 * Usage (test scenario 4 from TASK-009):
 *
 * ```ts
 * const sdk = new InMemorySdkAdapter();
 * sdk.failNextCreateWith("simulated SDK outage");
 * await assert.rejects(() => registry.register(spec));
 * assert.equal(sdk.calls.create.length, 1); // SDK was hit, write was rolled back
 * ```
 */
export class InMemorySdkAdapter implements AgentSdkAdapter {
  /** Set of sdk_agent_ids the SDK currently "knows about". */
  private readonly _known = new Set<string>();
  private _nextCreateId = 1;
  private _failNextCreate: string | null = null;
  private _failNextResume: string | null = null;

  /** Spy trace; tests assert on this. */
  readonly calls: {
    create: AgentCreateSpec[];
    list: number;
    resume: string[];
  } = { create: [], list: 0, resume: [] };

  /** Plant a failure for the very next `create` call. */
  failNextCreateWith(reason: string): void {
    this._failNextCreate = reason;
  }

  /** Plant a failure for the very next `resume` call. */
  failNextResumeWith(reason: string): void {
    this._failNextResume = reason;
  }

  /** Pre-populate sdk_agent_ids the SDK should claim to know. */
  seedKnown(...ids: string[]): void {
    for (const id of ids) this._known.add(id);
  }

  /** Inspect what the SDK currently believes (read-only). */
  knownIds(): string[] {
    return [...this._known];
  }

  async create(spec: AgentCreateSpec): Promise<{ sdk_agent_id: string }> {
    this.calls.create.push(spec);
    if (this._failNextCreate !== null) {
      const reason = this._failNextCreate;
      this._failNextCreate = null;
      throw new InMemorySdkPlantedError(`create failed: ${reason}`);
    }
    const id = `sdk-fake-${String(this._nextCreateId++).padStart(4, "0")}`;
    this._known.add(id);
    return { sdk_agent_id: id };
  }

  async list(): Promise<string[]> {
    this.calls.list += 1;
    return [...this._known];
  }

  async resume(sdkAgentId: string): Promise<void> {
    this.calls.resume.push(sdkAgentId);
    if (this._failNextResume !== null) {
      const reason = this._failNextResume;
      this._failNextResume = null;
      throw new InMemorySdkPlantedError(`resume failed: ${reason}`);
    }
    if (!this._known.has(sdkAgentId)) {
      throw new InMemorySdkPlantedError(
        `resume failed: sdk_agent_id="${sdkAgentId}" is not in the SDK's known set`,
      );
    }
  }
}
