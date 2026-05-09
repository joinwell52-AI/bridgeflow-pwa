/**
 * ReviewWriter tests — Sprint S4 TS-6.1 / TS-6.2 / TS-6.3.
 *
 * Coverage:
 *   - TS-6.1: write valid verdict → file exists + frontmatter passes
 *             `validate("review", ...)` from `@codeflow/protocol`
 *   - TS-6.2: review_id pattern enforced + refuse-overwrite contract
 *   - TS-6.3: atomic-write semantics: a failed write does NOT leave a
 *             half-written target file (tmp-file may exist as a
 *             diagnostic, but the canonical path is untouched)
 */

import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validate } from "@codeflow/protocol";
import { parse as parseYaml } from "yaml";

import { ReviewWriteError } from "../../registry/errors.ts";
import {
  ReviewWriter,
  renderReviewMarkdown,
  type ReviewVerdict,
} from "../ReviewWriter.ts";
import { readReviewFile, withTempReview } from "./helpers.ts";

function makeApprovedVerdict(overrides: Partial<ReviewVerdict> = {}): ReviewVerdict {
  return {
    review_id: "REVIEW-20260509-001-REVIEW-on-TASK-20260509-001-PM-to-DEV",
    subject_type: "task",
    subject_ref: "TASK-20260509-001-PM-to-DEV",
    reviewer_role: "REVIEW",
    reviewer_agent: "REVIEW-01",
    decision: "approved",
    rationale: "looks good",
    decided_at: "2026-05-09T16:00:00.000Z",
    decision_duration_ms: 1234,
    ...overrides,
  };
}

describe("ReviewWriter", () => {
  it("TS-6.1: write valid verdict → file exists + frontmatter passes review schema", async () => {
    await withTempReview(async ({ reviewsDir }) => {
      const writer = new ReviewWriter({ reviewsDir });
      const verdict = makeApprovedVerdict();
      const filepath = await writer.write(verdict, "Review body content");

      // File on disk.
      const stats = await stat(filepath);
      assert.ok(stats.isFile(), "REVIEW-*.md should be a regular file");
      assert.equal(
        filepath,
        join(reviewsDir, `${verdict.review_id}.md`),
        "filename = <reviewsDir>/<review_id>.md",
      );

      // Frontmatter parses + passes schema.
      const { frontmatter, body } = await readReviewFile(filepath);
      assert.equal(frontmatter["protocol"], "fcop", "writer auto-stamps protocol=fcop");
      assert.equal(frontmatter["review_id"], verdict.review_id);
      assert.equal(frontmatter["decision"], "approved");
      assert.equal(frontmatter["decided_at"], verdict.decided_at);
      assert.ok(body.includes("Review body content"), "body preserved verbatim");

      const result = await validate("review", frontmatter);
      assert.equal(
        result.valid,
        true,
        `frontmatter must satisfy review.schema.json (errors: ${
          JSON.stringify(result.errors, null, 2)
        })`,
      );
    });
  });

  it("TS-6.2: review_id pattern enforced + refuse-overwrite", async () => {
    await withTempReview(async ({ reviewsDir }) => {
      const writer = new ReviewWriter({ reviewsDir });

      // Bad pattern: missing the `-on-TASK-...` suffix.
      const bad = makeApprovedVerdict({ review_id: "REVIEW-2026-001-X" });
      await assert.rejects(
        () => writer.write(bad, "x"),
        (err: unknown) =>
          err instanceof ReviewWriteError &&
          /does not match the schema pattern/.test(err.message),
        "expected ReviewWriteError on bad review_id pattern",
      );

      // First write of a valid id succeeds.
      const v1 = makeApprovedVerdict();
      const filepath = await writer.write(v1, "first");
      assert.ok(existsSync(filepath));

      // Second write of the SAME review_id refuses to overwrite.
      const v2 = makeApprovedVerdict({ rationale: "different" });
      await assert.rejects(
        () => writer.write(v2, "second"),
        (err: unknown) =>
          err instanceof ReviewWriteError &&
          /refuses to overwrite/.test(err.message),
        "expected ReviewWriteError on refuse-overwrite",
      );

      // Original file content untouched.
      const { body } = await readReviewFile(filepath);
      assert.match(body, /first/);
      assert.doesNotMatch(body, /second/);
    });
  });

  it("TS-6.3: schema-violation throws BEFORE creating the file (atomic-write semantics — half-write impossible)", async () => {
    await withTempReview(async ({ reviewsDir }) => {
      const writer = new ReviewWriter({ reviewsDir });

      // decision="needs_human" without human_approval is a schema allOf
      // violation. The writer SHOULD reject before any fs activity.
      const bad: ReviewVerdict = {
        review_id: "REVIEW-20260509-002-REVIEW-on-TASK-20260509-002-PM-to-DEV",
        subject_type: "task",
        subject_ref: "TASK-20260509-002-PM-to-DEV",
        reviewer_role: "REVIEW",
        reviewer_agent: "REVIEW-01",
        decision: "needs_human",
        decided_at: "2026-05-09T16:00:00.000Z",
        // Deliberately missing human_approval.
      };
      await assert.rejects(
        () => writer.write(bad, "body"),
        (err: unknown) =>
          err instanceof ReviewWriteError &&
          /requires human_approval/.test(err.message),
      );

      // Target file must NOT exist on disk (atomic-write contract).
      const target = join(reviewsDir, `${bad.review_id}.md`);
      assert.equal(existsSync(target), false, "target file should NOT exist");

      // The .tmp staging file from atomic-write is also absent because we
      // bailed before atomicWriteJson was called.
      assert.equal(existsSync(`${target}.tmp`), false, ".tmp staging file should NOT exist");

      // decision="needs_changes" without required_changes — same contract.
      const bad2: ReviewVerdict = {
        review_id: "REVIEW-20260509-003-REVIEW-on-TASK-20260509-003-PM-to-DEV",
        subject_type: "task",
        subject_ref: "TASK-20260509-003-PM-to-DEV",
        reviewer_role: "REVIEW",
        reviewer_agent: "REVIEW-01",
        decision: "needs_changes",
        decided_at: "2026-05-09T16:00:00.000Z",
      };
      await assert.rejects(
        () => writer.write(bad2, "body"),
        (err: unknown) =>
          err instanceof ReviewWriteError &&
          /requires required_changes/.test(err.message),
      );
      assert.equal(
        existsSync(join(reviewsDir, `${bad2.review_id}.md`)),
        false,
        "needs_changes-without-required_changes target also absent",
      );
    });
  });

  it("renderReviewMarkdown: deterministic field order + needs_human path includes human_approval", async () => {
    const verdict: ReviewVerdict = {
      review_id: "REVIEW-20260509-004-REVIEW-on-TASK-20260509-004-PM-to-DEV",
      subject_type: "task",
      subject_ref: "TASK-20260509-004-PM-to-DEV",
      reviewer_role: "REVIEW",
      reviewer_agent: "REVIEW-01",
      decision: "needs_human",
      rationale: "not enough context to decide",
      human_approval: {
        pushed_to: "cli",
        pushed_at: "2026-05-09T16:00:00.000Z",
        approved_by: null,
        approved_at: null,
        trigger_reason: "verdict_parse_failed",
      },
      decided_at: "2026-05-09T16:00:00.000Z",
    };
    const text = renderReviewMarkdown(verdict, "## body");

    // Front-matter is well-formed and ordered.
    const [headLine, ...rest] = text.split("\n");
    assert.equal(headLine, "---");
    const yamlEnd = rest.indexOf("---");
    assert.ok(yamlEnd > 0, "closing --- must be present");
    const yamlBody = rest.slice(0, yamlEnd).join("\n");
    assert.match(yamlBody, /^protocol: fcop/, "first line is protocol stamp");
    assert.match(yamlBody, /trigger_reason: verdict_parse_failed/);
    assert.match(yamlBody, /pushed_to: cli/);

    // Schema check via ajv to be sure.
    const { frontmatter } = parseFromText(text);
    const result = await validate("review", frontmatter);
    assert.equal(
      result.valid,
      true,
      `needs_human verdict must satisfy schema (errors: ${
        JSON.stringify(result.errors, null, 2)
      })`,
    );
  });
});

function parseFromText(text: string): { frontmatter: Record<string, unknown> } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error("no front-matter");
  return { frontmatter: parseYaml(match[1] ?? "") as Record<string, unknown> };
}
