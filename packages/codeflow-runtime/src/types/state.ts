/**
 * Runtime-private state types for @codeflow/runtime.
 *
 * GOVERNANCE RULES (READ FIRST):
 *
 * 1. **Schema-mirrored fields are NOT redeclared here.**
 *    All Agent / Session / Review / Task / Skill *protocol* fields come from
 *    `@codeflow/protocol`. If you find yourself typing field names from the
 *    JSON schemas (`agent_id`, `layer`, `risk_level`, `decision`, etc.) in
 *    this file — STOP. Import the protocol type instead.
 *
 * 2. **Runtime-private constructs ARE allowed here.**
 *    Pure runtime concepts that have no place in the FCoP protocol — for
 *    example: `RuntimeEvent`, `SessionHandle`, `Unsubscribe` callbacks,
 *    `RuntimeBindingMode`, in-memory caches — live in this file.
 *    These don't go through D:\FCoP because they're not protocol contracts.
 *
 * 3. **Schema gaps go to the report, NOT to this file.**
 *    If runtime needs a field that's missing from `@codeflow/protocol`,
 *    add it to the "schema gaps" list in `REPORT-20260509-002-DEV-to-PM.md`.
 *    Per design doc §8.0 Hard Rule #4 + §3.3.1.b: schema evolution must
 *    originate in `D:\FCoP` (https://github.com/joinwell52-AI/FCoP),
 *    propagate through `packages/codeflow-protocol/`, and only then be
 *    consumed here.
 *
 * Reference: design doc `docs/design/codeflow-v2-on-fcop-sdk.md` §2.1, §3, §8.
 */

import type { Agent, Session, SessionRun } from "@codeflow/protocol";

// ───────────────────────────────────────────────────────────────────────────
// AgentRecord — Agent + runtime bookkeeping
// ───────────────────────────────────────────────────────────────────────────

/**
 * Where the runtime currently holds a binding to the SDK Agent.
 * Pure runtime concept — not in any FCoP schema.
 */
export type RuntimeBindingMode = "local" | "cloud";

/**
 * Why the runtime put an agent into the `failed` state.
 * Pure runtime diagnostic — not in any FCoP schema.
 */
export interface AgentFailure {
  /** ISO-8601 timestamp the failure was recorded. */
  failed_at: string;
  /** Human-readable reason. */
  reason: string;
  /** Optional structured cause (e.g. SDK error code). */
  cause?: unknown;
}

/**
 * AgentRecord = the protocol-level Agent (from @codeflow/protocol)
 *             + runtime-only bookkeeping fields.
 *
 * The runtime persists this in `agents.json` (Agent Registry's PCB).
 * The protocol-level Agent never has the `runtime_*` prefix; everything
 * runtime-private here is namespaced with `runtime_` to make it visually
 * obvious which fields cross the schema boundary.
 */
export interface AgentRecord {
  /** Protocol-level fields — direct passthrough of FCoP Agent schema. */
  protocol: Agent;
  /** Where the runtime currently believes the SDK Agent is bound. */
  runtime_binding_mode: RuntimeBindingMode;
  /** Last time runtime successfully reconciled with SDK. */
  runtime_last_reconciled_at?: string;
  /** Set when status === "error" or runtime marks failed. */
  runtime_failure?: AgentFailure;
}

// ───────────────────────────────────────────────────────────────────────────
// SessionRecord — Session + runtime bookkeeping
// ───────────────────────────────────────────────────────────────────────────

/**
 * SessionRecord = the protocol-level Session (from @codeflow/protocol)
 *               + runtime-only bookkeeping fields.
 *
 * Same `runtime_` prefix discipline as AgentRecord.
 */
export interface SessionRecord {
  /** Protocol-level fields — direct passthrough of FCoP Session schema. */
  protocol: Session;
  /**
   * Last event timestamp (any kind: token, tool_call, status_change).
   * Used for liveness heuristics; not promoted to protocol because
   * SessionRun.ended_at already covers terminal liveness needs.
   */
  runtime_last_event_at?: string;
  /**
   * Active run handle id, if any. Maps 1:1 to SessionRun.run_id but
   * only set while the run is actually in-flight.
   */
  runtime_active_run_id?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// RunHandle — runtime-only abstraction
// ───────────────────────────────────────────────────────────────────────────

/**
 * Lightweight handle to a single in-flight Run. Wraps the SDK Run object.
 *
 * Not in any schema — purely a runtime convenience for cancellation,
 * event subscription, and waiting. The persisted form is `SessionRun`
 * inside `SessionRecord.protocol.runs[]`.
 *
 * Defined as an interface so concrete runtime impls (S3+) can wrap the
 * SDK Run however they like, as long as they expose this shape.
 */
export interface RunHandle {
  /** Pattern: `^run-[a-z0-9-]+$` (matches SessionRun.run_id). */
  readonly run_id: string;
  /** Owning session_id. */
  readonly session_id: string;
  /** Owning agent_id. */
  readonly agent_id: string;
  /** Whether the underlying SDK run is still streaming. */
  isActive(): boolean;
  /** Request graceful cancellation. Idempotent. */
  cancel(reason: string): Promise<void>;
  /** Resolve when the run reaches a terminal status. */
  whenSettled(): Promise<SessionRun>;
}

// ───────────────────────────────────────────────────────────────────────────
// RuntimeEvent — what SessionManager.onEvent streams
// ───────────────────────────────────────────────────────────────────────────

/**
 * The 8 SDK message types observed in the spike (`_ignore/spike_sdk_doorbell/`)
 * + runtime-internal events (lifecycle / cancellation / error).
 *
 * Not in any schema. Subscribers (transcript writer, Mobile push, audit log)
 * can switch on `event_type` to dispatch.
 */
export type RuntimeEventType =
  // SDK-originated events (subset; full list resolved at S3)
  | "sdk.message"
  | "sdk.token"
  | "sdk.tool_call"
  | "sdk.tool_result"
  | "sdk.thinking"
  | "sdk.error"
  | "sdk.run_started"
  | "sdk.run_finished"
  // Runtime-originated events
  | "runtime.session_started"
  | "runtime.session_cancelled"
  | "runtime.session_failed"
  | "runtime.emergency_stop";

export interface RuntimeEvent {
  /** Monotonic-ish event id (e.g. ULID). */
  event_id: string;
  /** ISO-8601. */
  at: string;
  /** Coarse event family. */
  event_type: RuntimeEventType;
  session_id: string;
  /** Set for events tied to a specific run; absent for session-level events. */
  run_id?: string;
  /** Convenience: the agent_id for the session at event time. */
  agent_id: string;
  /** Free-form structured payload — shape varies by event_type. */
  payload?: unknown;
}

/** Returned by `onEvent` so callers can `unsubscribe()`. */
export type Unsubscribe = () => void;
