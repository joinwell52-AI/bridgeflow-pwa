/**
 * TaskDispatcher — glue layer that turns "file added to inbox" into
 * "agent driven by SessionManager" and writes the audit trail back.
 *
 * Scope (TASK-20260509-018 §主交付 4):
 *
 * Pipeline per `task_added` event:
 *   1. Parse the task.md (TaskParser).
 *      - Parse fail → log.warn + state_history `inbox → parse_failed`.
 *   2. Resolve the recipient agent via AgentRegistry.list({ role }).
 *      - Not found → log.warn + state_history `inbox → agent_not_found`.
 *   3. Call SessionManager.startSession(agent, task_id, payload).
 *      - InvalidAgentStatusError → state_history `inbox → rejected_busy`
 *        (Phase C default = serial; queue is v0.2 per TASK-018 line 199).
 *      - Other error → log.error + state_history `inbox → start_failed`.
 *   4. Subscribe to SessionManager.onEvent for runtime.session_ended /
 *      runtime.session_cancelled filtered by session_id; on settle,
 *      append state_history `dispatched → ended | cancelled` and
 *      unsubscribe (no leak).
 *
 * The dispatcher is intentionally robust to ALL classes of errors — a
 * single bad task must not crash the watcher loop. Errors are logged,
 * recorded as state_history when possible, and execution continues.
 */

import type { AgentRegistry } from "../registry/AgentRegistry.ts";
import { InvalidAgentStatusError } from "../registry/errors.ts";
import { TaskFileNotFoundError, TaskParseError } from "../registry/errors.ts";
import type {
  SessionManager,
  SessionStartPayload,
} from "../session/SessionManager.ts";
import type { RuntimeEvent, Unsubscribe } from "../types/state.ts";
import type { InboxEvent, InboxWatcher } from "./InboxWatcher.ts";
import type { StateHistoryEntry, StateHistoryWriter } from "./StateHistoryWriter.ts";
import { TaskParser } from "./TaskParser.ts";

export interface TaskDispatcherLogger {
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
}

export interface TaskDispatcherOpts {
  watcher: InboxWatcher;
  /** Optional parser override; default = TaskParser (the static class). */
  parser?: { parse: typeof TaskParser.parse };
  historyWriter: StateHistoryWriter;
  registry: AgentRegistry;
  sessionManager: SessionManager;
  /** Defaults to `console`. */
  logger?: TaskDispatcherLogger;
  /** Wall clock; tests inject a controlled clock. */
  now?: () => Date;
}

/**
 * Dispatch result tag — used internally and surfaced via `state_history`
 * notes for downstream observability.
 */
type DispatchOutcome =
  | { kind: "dispatched"; session_id: string }
  | { kind: "parse_failed"; reason: string }
  | { kind: "agent_not_found"; recipient: string }
  | { kind: "rejected_busy"; recipient: string; status: string }
  | { kind: "start_failed"; reason: string }
  | { kind: "no_task_id"; reason: string };

export class TaskDispatcher {
  private readonly _watcher: InboxWatcher;
  private readonly _parser: { parse: typeof TaskParser.parse };
  private readonly _historyWriter: StateHistoryWriter;
  private readonly _registry: AgentRegistry;
  private readonly _sessionManager: SessionManager;
  private readonly _logger: TaskDispatcherLogger;
  private readonly _now: () => Date;

  private _watcherUnsubscribe: (() => void) | null = null;
  private _started = false;

  /**
   * In-flight session subscriptions awaiting natural settlement. Keyed by
   * session_id so we can unsubscribe deterministically when the
   * runtime.session_ended / runtime.session_cancelled event lands.
   */
  private readonly _pendingSettlements = new Map<
    string,
    { unsubscribe: Unsubscribe; filepath: string }
  >();

  constructor(opts: TaskDispatcherOpts) {
    this._watcher = opts.watcher;
    this._parser = opts.parser ?? { parse: TaskParser.parse.bind(TaskParser) };
    this._historyWriter = opts.historyWriter;
    this._registry = opts.registry;
    this._sessionManager = opts.sessionManager;
    this._logger = opts.logger ?? {
      info: (msg, ...args) => console.log(msg, ...args),
      warn: (msg, ...args) => console.warn(msg, ...args),
      error: (msg, ...args) => console.error(msg, ...args),
    };
    this._now = opts.now ?? (() => new Date());
  }

  /**
   * Start the underlying InboxWatcher and subscribe to its events.
   * Resolves once the watcher is `ready` (initial scan complete).
   */
  async start(): Promise<void> {
    if (this._started) {
      throw new Error("TaskDispatcher.start() already called");
    }
    this._started = true;

    await this._watcher.start();
    this._watcherUnsubscribe = this._watcher.onEvent((event) =>
      this._handleInbox(event),
    );
  }

  /**
   * Stop the watcher and tear down any in-flight settlement subscriptions.
   * Idempotent.
   */
  async stop(): Promise<void> {
    if (this._watcherUnsubscribe) {
      this._watcherUnsubscribe();
      this._watcherUnsubscribe = null;
    }
    for (const { unsubscribe } of this._pendingSettlements.values()) {
      unsubscribe();
    }
    this._pendingSettlements.clear();
    await this._watcher.stop();
  }

  // ── private ──────────────────────────────────────────────────────────

  private async _handleInbox(event: InboxEvent): Promise<void> {
    const { filepath, filename, recipient } = event;
    let outcome: DispatchOutcome;
    try {
      outcome = await this._dispatch(filepath, filename, recipient);
    } catch (err) {
      // Last-line defense: any uncaught error becomes a logged warning.
      // The watcher loop must NEVER die from one bad task.
      this._logger.error(
        `[TaskDispatcher] uncaught error dispatching ${filename}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      outcome = {
        kind: "start_failed",
        reason:
          err instanceof Error ? err.message : `uncaught: ${String(err)}`,
      };
    }

    // Always record the outcome in state_history (best-effort).
    await this._appendHistory(filepath, this._outcomeToEntry(outcome)).catch(
      (err) => {
        if (err instanceof TaskFileNotFoundError) {
          this._logger.warn(
            `[TaskDispatcher] task file vanished before state_history append: ${filepath}`,
          );
        } else {
          this._logger.error(
            `[TaskDispatcher] state_history append failed for ${filename}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      },
    );
  }

  private async _dispatch(
    filepath: string,
    filename: string,
    filenameRecipient: string,
  ): Promise<DispatchOutcome> {
    // Step 1: parse.
    let parsed;
    try {
      parsed = await this._parser.parse(filepath);
    } catch (err) {
      const reason =
        err instanceof TaskParseError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      this._logger.warn(
        `[TaskDispatcher] parse failed for ${filename}: ${reason}`,
      );
      return { kind: "parse_failed", reason };
    }

    // Step 2: resolve recipient — frontmatter takes precedence; fallback
    // to the filename-derived role (parsed by InboxWatcher).
    const recipient = parsed.recipient ?? filenameRecipient;
    const candidates = await this._registry.list({ role: recipient });
    const agent = candidates[0];
    if (!agent) {
      this._logger.warn(
        `[TaskDispatcher] no agent registered for role="${recipient}" (task=${filename})`,
      );
      return { kind: "agent_not_found", recipient };
    }

    // Step 3: derive task_id — prefer frontmatter, fall back to filename
    // (without the .md extension). One of them must exist; otherwise the
    // SessionManager won't have a coherent record key.
    const taskId = parsed.task_id ?? filename.replace(/\.md$/, "");
    if (!taskId) {
      return {
        kind: "no_task_id",
        reason: "neither frontmatter.task_id nor filename yielded a task_id",
      };
    }

    // Step 4: hand off to SessionManager.
    const payload: SessionStartPayload = {
      text: parsed.body,
      context: {
        task_filepath: filepath,
        task_filename: filename,
        frontmatter: parsed.frontmatter,
      },
    };

    let sessionId: string;
    try {
      const handle = await this._sessionManager.startSession(
        agent.protocol.agent_id,
        taskId,
        payload,
      );
      sessionId = handle.session_id;
    } catch (err) {
      if (err instanceof InvalidAgentStatusError) {
        this._logger.warn(
          `[TaskDispatcher] agent ${agent.protocol.agent_id} busy ` +
            `(status=${err.attemptedStatus}); rejecting ${filename}`,
        );
        return {
          kind: "rejected_busy",
          recipient,
          status: err.attemptedStatus,
        };
      }
      const reason = err instanceof Error ? err.message : String(err);
      this._logger.error(
        `[TaskDispatcher] startSession failed for ${filename}: ${reason}`,
      );
      return { kind: "start_failed", reason };
    }

    // Step 5: subscribe to terminal events for this specific session, so
    // we can append `dispatched → ended | cancelled` later. We must
    // capture `unsubscribe` first, THEN read it inside the listener —
    // listeners can fire synchronously from within `onEvent` (unlikely
    // but legal), so the variable must already be initialized.
    let unsubscribe: Unsubscribe = () => {};
    const listener = (evt: RuntimeEvent): void => {
      if (evt.session_id !== sessionId) return;
      if (
        evt.event_type !== "runtime.session_ended" &&
        evt.event_type !== "runtime.session_cancelled"
      ) {
        return;
      }
      // Detach FIRST so a re-emitted event can't re-enter the handler.
      unsubscribe();
      this._pendingSettlements.delete(sessionId);

      const fromState = "dispatched";
      const toState =
        evt.event_type === "runtime.session_ended" ? "ended" : "cancelled";
      const note = describeSettlement(evt);
      void this._appendHistory(filepath, {
        at: this._now().toISOString(),
        by: "runtime",
        from: fromState,
        to: toState,
        ...(note ? { note } : {}),
      }).catch((err) => {
        if (err instanceof TaskFileNotFoundError) {
          // Same race tolerance as the inbox path.
          this._logger.warn(
            `[TaskDispatcher] task file vanished before settlement append: ${filepath}`,
          );
        } else {
          this._logger.error(
            `[TaskDispatcher] settlement append failed for ${filename}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      });
    };
    unsubscribe = this._sessionManager.onEvent(listener);
    this._pendingSettlements.set(sessionId, { unsubscribe, filepath });

    return { kind: "dispatched", session_id: sessionId };
  }

  private _outcomeToEntry(outcome: DispatchOutcome): StateHistoryEntry {
    const at = this._now().toISOString();
    const by = "runtime";
    switch (outcome.kind) {
      case "dispatched":
        return {
          at,
          by,
          from: "inbox",
          to: "dispatched",
          note: `session_id=${outcome.session_id}`,
        };
      case "parse_failed":
        return {
          at,
          by,
          from: "inbox",
          to: "parse_failed",
          note: outcome.reason,
        };
      case "agent_not_found":
        return {
          at,
          by,
          from: "inbox",
          to: "agent_not_found",
          note: `recipient=${outcome.recipient}`,
        };
      case "rejected_busy":
        return {
          at,
          by,
          from: "inbox",
          to: "rejected_busy",
          note: `recipient=${outcome.recipient}, agent_status=${outcome.status}`,
        };
      case "start_failed":
        return {
          at,
          by,
          from: "inbox",
          to: "start_failed",
          note: outcome.reason,
        };
      case "no_task_id":
        return {
          at,
          by,
          from: "inbox",
          to: "parse_failed",
          note: outcome.reason,
        };
    }
  }

  private async _appendHistory(
    filepath: string,
    entry: StateHistoryEntry,
  ): Promise<void> {
    await this._historyWriter.append(filepath, entry);
  }
}

function describeSettlement(evt: RuntimeEvent): string | undefined {
  const payload = evt.payload as
    | {
        status?: string;
        error?: string;
        reason?: string;
      }
    | undefined;
  if (!payload) return undefined;
  if (evt.event_type === "runtime.session_cancelled") {
    return payload.reason ? `reason=${payload.reason}` : undefined;
  }
  if (payload.error) return `status=${payload.status ?? "?"}, error=${payload.error}`;
  if (payload.status) return `status=${payload.status}`;
  return undefined;
}
