/**
 * SessionManager — the runtime's process-scheduler analogue at the
 * session layer. Owns the question "which agent is running which task
 * via which run, and how do we drive / cancel / observe it".
 *
 * Reference:
 * - design doc `docs/design/codeflow-v2-on-fcop-sdk.md` §2.1 subsystem 1,
 *   §3.5 Session Schema, §0.9.5 Mobile Emergency Stop
 * - dispatched from `docs/agents/tasks/TASK-20260509-002-PM-to-DEV.md`
 */

import type {
  RuntimeEvent,
  SessionRecord,
  Unsubscribe,
} from "../types/state.ts";
import type { RunHandle } from "./RunHandle.ts";

/**
 * Payload passed into `Agent.send()` for a freshly started session.
 *
 * S2 leaves this loosely typed — concrete payload schema is part of S3
 * Task Scheduler design (the bridge from `Task.md` front-matter to the
 * SDK send call). For S2 we just need a name to thread through.
 */
export interface SessionStartPayload {
  /** Plain text body sent to the SDK (Task.md body, typically). */
  text: string;
  /**
   * Optional structured context (schema decided in S3). MUST NOT carry
   * any FCoP protocol field as a top-level key; protocol fields live in
   * `Task` proper, which is referenced via `task_id`, not duplicated here.
   */
  context?: Record<string, unknown>;
}

/** Result of `cancelAllForEmergencyStop()`. */
export interface EmergencyStopResult {
  /** The session_ids that were running and got cancelled. */
  cancelled: string[];
  /**
   * Sessions that failed to cancel cleanly (e.g. SDK call timed out).
   * In v0.1 these are surfaced for the operator to investigate; the
   * runtime does NOT retry automatically (that's S6+ behavior).
   */
  failed_to_cancel: { session_id: string; reason: string }[];
}

/** Constructor options. S3+ will flesh this out (SDK client, store, etc.). */
export interface SessionManagerOptions {
  /**
   * Optional adapter to a SessionRecord persistence layer.
   * S2 leaves this `unknown` — the actual store contract lands in S3
   * once `crash-recovery.md` decision 4 is settled.
   */
  store?: unknown;
}

/**
 * SessionHandle — short-lived handle returned by `startSession`.
 *
 * Encapsulates the active RunHandle for callers that want to cancel /
 * await without going through the SessionManager again. The persisted
 * form remains `SessionRecord`.
 */
export interface SessionHandle {
  readonly session_id: string;
  readonly agent_id: string;
  readonly task_id: string;
  /** The currently in-flight run, if any. */
  readonly activeRun: RunHandle | null;
  /** Convenience: latest snapshot of the persisted record. */
  snapshot(): Promise<SessionRecord>;
}

/**
 * SessionManager — central coordinator for agent×task×run sessions.
 *
 * Lifecycle:
 *
 * 1. `startSession(agentId, taskId, payload)` → resolve agent record →
 *    `Agent.resume(...)` → `agent.send(payload)` → wrap in `SessionHandle`.
 * 2. `getSession(sessionId)` / `listActive()` → in-memory query.
 * 3. `cancelSession(sessionId, reason)` → SDK `run.cancel()` + persist
 *    SessionRecord.status=cancelled + emit `runtime.session_cancelled`.
 * 4. `cancelAllForEmergencyStop()` → §0.9.5 red button: cancel everything
 *    + write `EMERGENCY-{ts}.md` (schema lands in v0.2 S10).
 * 5. `onEvent(handler)` → subscribe to all 8 SDK event types + 4 runtime
 *    event types (see RuntimeEventType in `types/state.ts`).
 *
 * Invariants enforced at this layer:
 *
 * - **Same agent, sequential tasks** — by default, an agent cannot start
 *   a new session while a previous one is still `running`. Concurrency
 *   override is per-Agent and lives in a future protocol field (see
 *   "schema gaps" in REPORT-002); for S2/S3 the answer is "no concurrency".
 * - **Cancel is idempotent** — `cancelSession` called twice on the same id
 *   succeeds twice; the second call is a no-op + warning log.
 * - **Emergency stop is privileged** — `cancelAllForEmergencyStop` MUST
 *   only be invoked from an `admin`-layer caller (mobile push or CLI by
 *   ADMIN-01). Authorization happens at the entrypoint, not here, but
 *   the method name is intentionally explicit so misuse stands out in
 *   code review.
 *
 * S2 STATE: every method below throws `Error("[S2 skeleton] ...")`. Method
 * shapes are frozen for S3/S4 to fill in.
 */
export class SessionManager {
  // S3 will reference these in every method body. Marked `_` to silence
  // unused-private-field lints in the S2 skeleton phase.
  private readonly _opts: SessionManagerOptions;

  constructor(opts: SessionManagerOptions = {}) {
    this._opts = opts;
  }

  /**
   * Start a new agent×task session.
   *
   * @param agentId — FCoP-level role id (e.g. `"DEV-01"`); resolved via
   *   AgentRegistry to find the live SDK binding.
   * @param taskId — FCoP Task id (filename stem). NOT validated for content
   *   here; that's the Task Scheduler's job (S3).
   * @param payload — what to send to the SDK on session start.
   * @returns a SessionHandle for cancellation / observation.
   *
   * @throws `Error` if `agentId` is unknown to the AgentRegistry.
   * @throws `Error` if the agent is already running another session and
   *   concurrent sessions are not allowed (default).
   * @throws `Error` if SDK `agent.send()` fails synchronously. Async errors
   *   surface via `onEvent` (`sdk.error` event_type).
   */
  async startSession(
    agentId: string,
    taskId: string,
    payload: SessionStartPayload,
  ): Promise<SessionHandle> {
    void agentId;
    void taskId;
    void payload;
    throw new Error(
      "[S2 skeleton] SessionManager.startSession not implemented — see TASK-20260509-002 §必交付 3; lands in S3-S4.",
    );
  }

  /**
   * Single-record lookup by `session_id`.
   *
   * @param sessionId — pattern `^session-[a-z0-9-]+$`.
   * @returns the persisted record, or `null` if absent. Does NOT throw on
   *   missing — symmetric with `AgentRegistry.get`.
   *
   * @throws never.
   */
  async getSession(sessionId: string): Promise<SessionRecord | null> {
    void sessionId;
    throw new Error(
      "[S2 skeleton] SessionManager.getSession not implemented — see TASK-20260509-002 §必交付 3; lands in S3-S4.",
    );
  }

  /**
   * List sessions whose `protocol.status === "running"`. Used by the
   * Mobile Console "Agent 状态" tab (§0.9.3) and by the v0.2 patrol agent
   * for liveness checks.
   *
   * @returns array, possibly empty.
   * @throws never.
   */
  async listActive(): Promise<SessionRecord[]> {
    throw new Error(
      "[S2 skeleton] SessionManager.listActive not implemented — see TASK-20260509-002 §必交付 3; lands in S3-S4.",
    );
  }

  /**
   * Graceful cancellation of a running session.
   *
   * Steps (S3 impl):
   *  1. SDK `run.cancel()` on the active run, if any.
   *  2. Persist SessionRecord.status=`cancelled` + ended_at=now.
   *  3. Append a `cancellation` line to the run's transcript.
   *  4. Emit `runtime.session_cancelled` to all `onEvent` subscribers.
   *
   * Idempotent — calling twice on the same id succeeds twice; the second
   * call logs a warning and is otherwise a no-op.
   *
   * @param sessionId — session to cancel.
   * @param reason — human-readable reason; appears in the transcript and
   *   the emitted RuntimeEvent payload.
   *
   * @throws `Error` if `sessionId` is unknown.
   * @throws never if the session exists but is already terminal — that's
   *   the idempotent path.
   */
  async cancelSession(sessionId: string, reason: string): Promise<void> {
    void sessionId;
    void reason;
    throw new Error(
      "[S2 skeleton] SessionManager.cancelSession not implemented — see TASK-20260509-002 §必交付 3; lands in S3-S4.",
    );
  }

  /**
   * §0.9.5 Mobile Emergency Stop ⛔ — cancel ALL running sessions in one
   * shot. Used when ADMIN-01 hits the red button on the Mobile Console.
   *
   * Side effect: writes `EMERGENCY-{ts}.md` to the FCoP task directory.
   * Schema for that file lands in v0.2 S10 (Mobile Governance MVP). For
   * v0.1, S2 leaves the file format as a TODO inside the implementation.
   *
   * AUTHORIZATION: this method itself does NOT check for admin layer —
   * the caller (CLI handler, mobile bridge) is responsible. The method
   * name is intentionally explicit as a code-review tripwire.
   *
   * @returns counts of cancelled vs. failed-to-cancel sessions.
   *
   * @throws never (best-effort; failures are reported in `failed_to_cancel`).
   */
  async cancelAllForEmergencyStop(): Promise<EmergencyStopResult> {
    throw new Error(
      "[S2 skeleton] SessionManager.cancelAllForEmergencyStop not implemented — see TASK-20260509-002 §必交付 3; lands in v0.2 S10.",
    );
  }

  /**
   * Subscribe to runtime events. Returns an `Unsubscribe` function.
   *
   * Subscribers receive ALL `RuntimeEvent`s — both SDK-originated (the 8
   * SDK event types per the spike) and runtime-originated (lifecycle,
   * cancellation, emergency stop). Filtering is the subscriber's job.
   *
   * Common subscribers:
   *  - Transcript writer (writes to `.codeflow/state/transcripts/<run-id>.md`)
   *  - Mobile push bridge (v0.2)
   *  - Audit log writer (v0.5)
   *
   * @param handler — invoked synchronously per event. MUST NOT throw;
   *   throwing handlers will be unsubscribed and an error logged.
   * @returns Unsubscribe function. Idempotent — safe to call multiple times.
   */
  onEvent(handler: (event: RuntimeEvent) => void): Unsubscribe {
    void handler;
    throw new Error(
      "[S2 skeleton] SessionManager.onEvent not implemented — see TASK-20260509-002 §必交付 3; lands in S3-S4.",
    );
  }
}
