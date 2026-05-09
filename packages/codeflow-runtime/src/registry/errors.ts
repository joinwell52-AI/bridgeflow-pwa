/**
 * Named error classes for the AgentRegistry / RuntimeBootstrap surface.
 *
 * Why named classes (instead of one generic `Error`):
 *
 * - Tests `assert.throws(fn, ValidationError)` — class identity is the
 *   only stable assertion handle (message strings drift over time).
 * - Callers (Mobile push, audit log, stdout summary) switch on `instanceof`
 *   to choose user-facing wording without parsing strings.
 * - `crash-recovery.md` decision 2 mandates "HARD FAIL on agents.json
 *   corruption" — distinguishing `RuntimeBootstrapError` from a normal
 *   per-record `RegistryWriteError` is what makes that mandate testable.
 *
 * All error classes here are `@codeflow/runtime`-private. No FCoP schema
 * leakage. Per design doc §8.0 hard rule #4, schema-level error types
 * (if any are ever needed) live in `@codeflow/protocol`.
 */

/**
 * Thrown when an input fails ajv validation against a `@codeflow/protocol`
 * schema. The message is the human-readable summary; structured detail
 * lives on the `errors` field.
 *
 * Used by: `AgentRegistry.register` (rejecting bad `agentSpec`).
 */
export class ValidationError extends Error {
  override readonly name = "ValidationError";
  /** Raw ajv error objects, in the order ajv returned them. */
  readonly errors: unknown[];

  constructor(message: string, errors: unknown[]) {
    super(message);
    this.errors = errors;
  }
}

/**
 * Thrown when a caller tries to `register({ layer: "admin" })`. Admin-layer
 * agents are spawned by the human ADMIN entry only — never by the runtime
 * (§0.9.1 + design doc §3.2 layer enforcement).
 *
 * Implementation MUST throw this BEFORE calling the SDK adapter, otherwise
 * we leak SDK quota to a request the runtime is going to refuse. Test
 * scenario 3 in TASK-009 checks exactly this property.
 */
export class LayerViolationError extends Error {
  override readonly name = "LayerViolationError";
  readonly attemptedLayer: string;

  constructor(attemptedLayer: string, message?: string) {
    super(
      message ??
        `agents with layer="${attemptedLayer}" cannot be spawned via the runtime; ` +
          "admin-layer agents are reserved for the human ADMIN entry (see design doc §0.9.1).",
    );
    this.attemptedLayer = attemptedLayer;
  }
}

/**
 * Thrown when `resume`, `updateRuntimeBinding`, or `markFailed` is called
 * with an `agent_id` not present in `agents.json`.
 *
 * `AgentRegistry.get` deliberately does NOT throw this — it returns `null`
 * for the "is this agent registered yet?" probe. Throwing is reserved for
 * methods where the missing record is a contract violation, not a query.
 */
export class AgentNotFoundError extends Error {
  override readonly name = "AgentNotFoundError";
  readonly agentId: string;

  constructor(agentId: string) {
    super(`agent_id="${agentId}" is not registered in agents.json`);
    this.agentId = agentId;
  }
}

/**
 * Thrown when the persistent store cannot make a write durable.
 *
 * NOTE: by atomic-rename design (decision 1), the on-disk `agents.json`
 * is NEVER half-written when this throws — the temp file may linger as
 * a diagnostic but the active `agents.json` is exactly what it was
 * before the failed write. Tests rely on that property (scenario 4 +
 * scenario 10).
 */
export class RegistryWriteError extends Error {
  override readonly name = "RegistryWriteError";
  override readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thrown when `RuntimeBootstrap.run()` cannot proceed past step 1
 * (`PersistentStore.loadAll()`). Examples: `agents.json` is corrupt
 * JSON, the schema-validation phase failed catastrophically, etc.
 *
 * `crash-recovery.md` decision 2 explicitly forbids "half-started"
 * states — the caller (typically `bin/codeflow-runtime`) must
 * `process.exit(1)` and let the operator triage manually.
 */
export class RuntimeBootstrapError extends Error {
  override readonly name = "RuntimeBootstrapError";
  override readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thrown when `AgentRegistry.register` is called while
 * `RuntimeBootstrap.run()` is still in progress. This is the explicit
 * race-defense from `crash-recovery.md` decision 2 ("Reconciliation is
 * synchronous — must finish before accepting new requests").
 *
 * Callers should retry after the bootstrap report is observed (or, more
 * commonly, structure their startup so register() simply isn't called
 * inside `RuntimeBootstrap.run()`).
 */
export class RuntimeNotReadyError extends Error {
  override readonly name = "RuntimeNotReadyError";

  constructor(message?: string) {
    super(
      message ??
        "RuntimeBootstrap.run() is in progress; AgentRegistry.register() is not allowed until reconciliation finishes.",
    );
  }
}
