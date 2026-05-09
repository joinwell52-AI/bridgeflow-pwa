/**
 * NeedsHumanGate — the v0.1 fallback when a `decision === "needs_human"`
 * verdict needs to leave the runtime and go to a human.
 *
 * Scope (TASK-20260509-022 §主交付 2):
 *
 * - v0.1 sink = `"cli"` only. The gate prints a single structured line
 *   to the configured `logger.info` so any tail-following operator (or
 *   the `codeflow-shell` daemon's stderr → log file) sees it.
 * - v0.2 will replace the sink with a `MobilePushAdapter` (out of scope
 *   here per TASK-022 §不做 line 238 + design doc §0.9.3 第 4 屏 +
 *   §0.9.4). The constructor signature already accepts `sink: "mobile"`
 *   to lock in the surface — but v0.1 throws if asked to push to mobile
 *   so a regression PR can't accidentally ship a half-implemented push.
 * - The returned `HumanApproval` is a STUB: only `pushed_to + pushed_at +
 *   trigger_reason` are populated (the `additionalProperties: false` schema
 *   for `human_approval` accepts these three plus `approved_by` /
 *   `approved_at`, which v0.1 leaves as `null` until a real human ack
 *   lands via Mobile in v0.2+).
 *
 * Why a stub at all (instead of "wait for ack"):
 *
 * - v0.1's `ReviewEngine` settles synchronously at session_ended time —
 *   blocking on a real human is what v0.2 Mobile push is for. The stub
 *   gives the audit trail a complete `human_approval` block that says
 *   "we pushed; nobody approved yet", which is the truth at v0.1 stage.
 * - The schema's `additionalProperties: false` on `human_approval` means
 *   we MUST NOT invent extra fields here.
 *
 * Reference:
 *   - design doc §0.9.4 high-risk red lines
 *   - design doc §0.9.3 (Mobile Audit screen — v0.2)
 *   - review.schema.json#properties.human_approval
 *   - TASK-20260509-022 §主交付 2
 */

import type { HumanApproval } from "./ReviewWriter.ts";

/**
 * What the engine pushes through the gate when a verdict requires a human.
 * Carries enough context that `ReviewWriter` can fill in `human_approval`
 * fields AND the future Mobile push notification can render a meaningful
 * "approve this" screen.
 */
export interface HumanPushRequest {
  /** Pattern: `^REVIEW-\d{8}-\d{3}-...$`. */
  review_id: string;
  /** The Task this review belongs to (for cross-link in the Mobile UI). */
  task_id: string;
  /** Reviewer role that produced the original verdict. */
  reviewer_role: string;
  /**
   * Why human approval was triggered. Free-form short string. Examples:
   *   - "high_risk_skill_invocation"
   *   - "review_board_consensus_failed"
   *   - "verdict_parse_failed"
   *   - "reviewer_not_found"
   */
  trigger_reason: string;
  /** Optional rationale forwarded from the reviewer (for context). */
  rationale?: string;
}

export interface NeedsHumanGateLogger {
  info: (msg: string, ...args: unknown[]) => void;
}

export interface NeedsHumanGateOptions {
  /**
   * v0.1 strict allowlist = `"cli"`. Construction with `"mobile"` throws
   * eagerly so a future regression can't ship a half-implemented push.
   *
   * v0.2 will widen this: `"mobile"` will route through MobilePushAdapter
   * (a stable interface defined in §10.3 of the design doc).
   */
  sink?: "cli" | "mobile";
  /** Defaults to `console`. */
  logger?: NeedsHumanGateLogger;
  /** Wall clock — tests inject. */
  now?: () => Date;
}

/**
 * v0.1 thrown when caller asks the gate to push to a sink the runtime
 * does not yet support. Defined as a plain Error subclass (instead of
 * promoting to `registry/errors.ts`) because v0.2 will replace the gate
 * implementation entirely; this error is intentionally short-lived.
 */
export class UnsupportedHumanPushSinkError extends Error {
  override readonly name = "UnsupportedHumanPushSinkError";
  readonly sink: string;

  constructor(sink: string) {
    super(
      `NeedsHumanGate sink="${sink}" is not implemented in v0.1; ` +
        `only "cli" is supported (Mobile push is v0.2 — see design doc §0.9.3).`,
    );
    this.sink = sink;
  }
}

export class NeedsHumanGate {
  private readonly _sink: "cli" | "mobile";
  private readonly _logger: NeedsHumanGateLogger;
  private readonly _now: () => Date;

  constructor(opts: NeedsHumanGateOptions = {}) {
    this._sink = opts.sink ?? "cli";
    if (this._sink !== "cli") {
      // Eager fail: catching at construction time means a misconfigured
      // Runtime never even starts to dispatch reviews — better than
      // discovering the missing implementation only when the first
      // needs_human verdict fires.
      throw new UnsupportedHumanPushSinkError(this._sink);
    }
    this._logger = opts.logger ?? { info: (m, ...a) => console.log(m, ...a) };
    this._now = opts.now ?? (() => new Date());
  }

  /**
   * v0.1 sink semantics: print a one-line marker to the logger's `info`
   * stream so any operator (or the `codeflow-shell` daemon's log file)
   * sees the request. **Does NOT block** — v0.1 is fire-and-forget; the
   * returned `HumanApproval` carries `approved_by: null + approved_at: null`
   * to signal "pushed, awaiting human" in the audit trail.
   *
   * v0.2 will replace the body with `MobilePushAdapter.push(...)` and
   * the returned promise will resolve only after the human acks (or a
   * configured SLO timer fires).
   */
  async push(req: HumanPushRequest): Promise<HumanApproval> {
    const pushedAt = this._now().toISOString();

    // One structured line — designed to be `grep`-able and unique enough
    // for the future Mobile push observer to pivot on.
    this._logger.info(
      `[NeedsHumanGate] human approval required: ` +
        `review_id="${req.review_id}" task_id="${req.task_id}" ` +
        `reviewer_role="${req.reviewer_role}" ` +
        `trigger_reason="${req.trigger_reason}" ` +
        `(sink=${this._sink}, pushed_at=${pushedAt})` +
        (req.rationale ? ` rationale="${truncate(req.rationale, 200)}"` : ""),
    );

    return {
      pushed_to: this._sink,
      pushed_at: pushedAt,
      approved_by: null,
      approved_at: null,
      trigger_reason: req.trigger_reason,
    };
  }

  /** Read-only accessor — for diagnostic logging in Runtime.start(). */
  get sink(): "cli" | "mobile" {
    return this._sink;
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
