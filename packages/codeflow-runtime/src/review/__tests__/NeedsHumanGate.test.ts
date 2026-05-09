/**
 * NeedsHumanGate tests — Sprint S4 TS-6.4 / TS-6.5.
 *
 * Coverage:
 *   - TS-6.4: push("cli") → logger.info contains trigger_reason +
 *             returned HumanApproval has pushed_to="cli"
 *   - TS-6.5: returned pushed_at is a valid ISO-8601 timestamp
 *   - bonus: construction with sink="mobile" throws (eager-fail) so a
 *            future regression PR can't accidentally ship a stub push
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  NeedsHumanGate,
  UnsupportedHumanPushSinkError,
} from "../NeedsHumanGate.ts";
import { quietLogger } from "./helpers.ts";

describe("NeedsHumanGate", () => {
  it("TS-6.4: push to cli sink → logger.info contains trigger_reason + returns stub HumanApproval", async () => {
    const logger = quietLogger();
    const gate = new NeedsHumanGate({ sink: "cli", logger });
    assert.equal(gate.sink, "cli");

    const approval = await gate.push({
      review_id:
        "REVIEW-20260509-001-REVIEW-on-TASK-20260509-001-PM-to-DEV",
      task_id: "TASK-20260509-001-PM-to-DEV",
      reviewer_role: "REVIEW",
      trigger_reason: "verdict_parse_failed",
      rationale: "reviewer output did not match VERDICT regex",
    });

    // Returned stub.
    assert.equal(approval.pushed_to, "cli");
    assert.equal(approval.trigger_reason, "verdict_parse_failed");
    assert.equal(approval.approved_by, null);
    assert.equal(approval.approved_at, null);

    // Logger captured the structured marker.
    assert.equal(logger.logs.length, 1);
    const line = logger.logs[0]!;
    assert.match(line, /\[NeedsHumanGate\]/);
    assert.match(line, /trigger_reason="verdict_parse_failed"/);
    assert.match(line, /reviewer_role="REVIEW"/);
    assert.match(line, /task_id="TASK-20260509-001-PM-to-DEV"/);
    assert.match(line, /sink=cli/);
  });

  it("TS-6.5: returned pushed_at is a valid ISO-8601 timestamp", async () => {
    const logger = quietLogger();
    const gate = new NeedsHumanGate({ sink: "cli", logger });

    const before = Date.now();
    const approval = await gate.push({
      review_id:
        "REVIEW-20260509-002-REVIEW-on-TASK-20260509-002-PM-to-DEV",
      task_id: "TASK-20260509-002-PM-to-DEV",
      reviewer_role: "REVIEW",
      trigger_reason: "reviewer_not_found",
    });
    const after = Date.now();

    // pushed_at parses as a Date.
    const ts = Date.parse(approval.pushed_at);
    assert.ok(!Number.isNaN(ts), `pushed_at="${approval.pushed_at}" must parse`);

    // Pattern is ISO-8601 (YYYY-MM-DDTHH:MM:SS.sssZ).
    assert.match(approval.pushed_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/);

    // Timestamp is within the wall-clock window of this test.
    assert.ok(ts >= before, `pushed_at >= before (got ${ts} vs ${before})`);
    assert.ok(ts <= after, `pushed_at <= after (got ${ts} vs ${after})`);
  });

  it("constructing with sink=\"mobile\" eagerly throws UnsupportedHumanPushSinkError (v0.1 only supports cli)", () => {
    assert.throws(
      () => new NeedsHumanGate({ sink: "mobile" }),
      (err: unknown) =>
        err instanceof UnsupportedHumanPushSinkError &&
        /not implemented in v0\.1/.test(err.message),
    );
  });
});
