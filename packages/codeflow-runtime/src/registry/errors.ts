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

// ───────────────────────────────────────────────────────────────────────────
// Session-layer errors (Sprint S3 Phase B)
//
// Co-located with the registry error file deliberately: same governance
// rationale (named-class identity for `assert.rejects` + `instanceof`
// dispatch in Mobile push / audit log), and consumers tend to import a
// single error module rather than two. If the session layer ever grows a
// large error vocabulary we can split, but Phase B (3 deliverables) keeps
// the count low — see decision J in REPORT-20260509-013.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Thrown when `SessionManager.cancelSession` (or any other session op
 * that requires an existing record) is called with a `session_id` not
 * present in the SessionStore.
 *
 * `getSession` deliberately does NOT throw this — it returns `null` for
 * the "is this session known?" probe (symmetric with `AgentRegistry.get`).
 * Throwing is reserved for methods where the missing record is a contract
 * violation, not a query.
 */
export class SessionNotFoundError extends Error {
  override readonly name = "SessionNotFoundError";
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(`session_id="${sessionId}" is not present in SessionStore`);
    this.sessionId = sessionId;
  }
}

/**
 * Thrown when `SessionManager.startSession` is invoked against an agent
 * whose protocol-level `status` is not in the allow-list (`idle | error`).
 *
 * Phase B default = serial sessions per agent (TASK-013 §主交付 1
 * key invariant: "不允许 startSession on running, 除非 §3.2 explicit
 * concurrency 允许"). `_attemptedStatus` lets callers route the error
 * to a useful Mobile push message ("agent is still running task X" vs.
 * "agent is in failed state, requires manual reset").
 */
export class InvalidAgentStatusError extends Error {
  override readonly name = "InvalidAgentStatusError";
  readonly agentId: string;
  readonly attemptedStatus: string;
  readonly allowedStatuses: readonly string[];

  constructor(
    agentId: string,
    attemptedStatus: string,
    allowedStatuses: readonly string[],
  ) {
    super(
      `agent_id="${agentId}" is in status="${attemptedStatus}"; ` +
        `startSession requires status ∈ {${allowedStatuses.join(", ")}} ` +
        `(see TASK-20260509-013 §主交付 1 invariant: serial sessions per agent).`,
    );
    this.agentId = agentId;
    this.attemptedStatus = attemptedStatus;
    this.allowedStatuses = allowedStatuses;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Scheduler-layer errors (Sprint S3 Phase C)
//
// Co-located with the registry/session error file per Phase B decision J:
// callers tend to import a single error module; keeping the scheduler error
// surface here means downstream code (Mobile push, audit log) only needs one
// `import { ... } from "@codeflow/runtime/registry/errors"` line.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Thrown when `TaskParser.parse` cannot read or interpret a Task file.
 *
 * Two failure modes:
 *
 * 1. The YAML front-matter exists but is malformed (e.g. unbalanced quotes,
 *    duplicate keys). The `cause` is the underlying yaml-parser error.
 * 2. A field that's expected to be typed (e.g. `priority`, `recipient`)
 *    has a wrong shape and the caller asked for strict mode (Phase C
 *    default = lenient — see `TaskParser.parse` doc).
 *
 * Note that "no front-matter at all" is NOT an error — `TaskParser` returns
 * `frontmatter: {}` and the full body in that case (per TASK-018 §主交付 2
 * implementation point: "tolerate files without front-matter").
 */
export class TaskParseError extends Error {
  override readonly name = "TaskParseError";
  readonly filepath: string;
  override readonly cause?: unknown;

  constructor(filepath: string, message: string, options?: { cause?: unknown }) {
    super(`TaskParser failed for "${filepath}": ${message}`);
    this.filepath = filepath;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thrown when `StateHistoryWriter.append` is asked to append to a Task file
 * that no longer exists on disk (the watcher may have seen it briefly during
 * a `git checkout` flicker, or the file was unlinked between dispatch and
 * settlement).
 *
 * The dispatcher MUST catch this and degrade to a logger.warn — it's never
 * a runtime-fatal error (a missing file just means we lost the audit trail
 * for that one task; the next chokidar add re-creates the dispatch path).
 */
export class TaskFileNotFoundError extends Error {
  override readonly name = "TaskFileNotFoundError";
  readonly filepath: string;
  override readonly cause?: unknown;

  constructor(filepath: string, options?: { cause?: unknown }) {
    super(`Task file not found at "${filepath}" (expected for state_history append)`);
    this.filepath = filepath;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
