/**
 * ReviewWriter — persist `ReviewVerdict` records as `REVIEW-*.md` files
 * whose YAML front-matter conforms to `@codeflow/protocol/schemas/review.schema.json`.
 *
 * Scope (TASK-20260509-022 §主交付 1):
 *
 * - Filename format: `REVIEW-{date}-{seq}-{REVIEWER}-on-TASK-{date}-{seq}.md`,
 *   matching the schema's `review_id.pattern` regex
 *   (`^REVIEW-\d{8}-\d{3}-[A-Z]+-on-TASK-\d{8}-\d{3}.*$`).
 * - Front-matter is the YAML serialization of `ReviewVerdict` — the runtime
 *   contract mirrors the schema 1:1; we DO NOT redeclare schema fields here
 *   (per `types/state.ts` governance rule #1 — schema-mirrored fields come
 *   from `@codeflow/protocol`).
 * - Body is a free-form markdown blob (rationale + reviewer notes); the
 *   `additionalProperties: true` schema allows future extension fields,
 *   but v0.1 only writes the schema-defined fields verbatim.
 * - Writes use `atomicWriteJson` from `_internal/atomic-write.ts` (Phase A
 *   helper) — the helper writes utf-8 bodies as atomically as JSON despite
 *   the historical "Json" name; see helper docstring §"body any utf-8 string".
 * - Refuses to overwrite an existing `REVIEW-*.md` file with the same
 *   `review_id` (TS-6.2 + TASK-022 §主交付 1 implementation point).
 *
 * Reference:
 *   - `packages/codeflow-protocol/schemas/review.schema.json`
 *   - design doc §3.4 Review Schema
 *   - TASK-20260509-022 §主交付 1
 *
 * Ownership: `ReviewWriter` only knows about *persisting* verdicts. Deciding
 * the verdict shape (decision enum, rationale wording) belongs to
 * `ReviewEngine`; running the human-approval gate belongs to `NeedsHumanGate`.
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

import { stringify as stringifyYaml } from "yaml";

import { atomicWriteJson, cleanupTmp } from "../_internal/atomic-write.ts";
import { ReviewWriteError } from "../registry/errors.ts";

// ───────────────────────────────────────────────────────────────────────────
// Public types — mirror review.schema.json properties.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Subject of the review — what's being approved/rejected.
 * Mirrors `review.schema.json#properties.subject_type.enum`.
 */
export type ReviewSubjectType =
  | "task"
  | "code_change"
  | "report"
  | "role_switch";

/**
 * Verdict outcome enum.
 * Mirrors `review.schema.json#properties.decision.enum`.
 */
export type ReviewDecision =
  | "approved"
  | "rejected"
  | "needs_changes"
  | "abstained"
  | "needs_human";

/**
 * Human-approval block. Mirrors `review.schema.json#properties.human_approval`.
 *
 * Schema is `additionalProperties: false`, so the YAML emitter MUST NOT
 * leak any extra keys. Required: `pushed_to + pushed_at + trigger_reason`.
 */
export interface HumanApproval {
  pushed_to: "mobile" | "cli";
  pushed_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  trigger_reason: string;
}

/**
 * The verdict record that lands as YAML front-matter in `REVIEW-*.md`.
 *
 * Mirrors `review.schema.json#properties` (minus `$schema` and the v0.5+
 * `review_board` nested object, which v0.1 does not populate). The
 * `protocol` field is auto-stamped to `"fcop"` by the writer — callers
 * should NOT pass it.
 */
export interface ReviewVerdict {
  /** Pattern: `^REVIEW-\d{8}-\d{3}-[A-Z]+-on-TASK-\d{8}-\d{3}.*$`. */
  review_id: string;
  subject_type: ReviewSubjectType;
  /** ID of the object being reviewed (e.g. task_id). */
  subject_ref: string;
  /** Single-reviewer mode (v0.1 default). v0.5+ `review_board` lives in schema. */
  reviewer_role: string | null;
  reviewer_agent: string | null;
  decision: ReviewDecision;
  rationale?: string;
  /** Required when `decision === "needs_changes"` (schema allOf). */
  required_changes?: string | string[];
  /** Required when `decision === "needs_human"` (schema allOf). */
  human_approval?: HumanApproval;
  decided_at: string;
  decision_duration_ms?: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────────────────

/**
 * Filename regex: must satisfy review.schema.json `review_id.pattern`.
 * The trailing `.md` is appended by the writer; the regex matches the bare
 * review_id (without extension).
 */
const REVIEW_ID_PATTERN = /^REVIEW-\d{8}-\d{3}-[A-Z]+-on-TASK-\d{8}-\d{3}.*$/;

/**
 * The schema field-set a v0.1 ReviewWriter emits. Future schema additions
 * (review_board, $schema URI) live here so an `unknown`-typed extension
 * field never silently leaks past the typed surface.
 */
const FRONTMATTER_FIELD_ORDER: (keyof Record<string, unknown>)[] = [
  "protocol",
  "review_id",
  "subject_type",
  "subject_ref",
  "reviewer_role",
  "reviewer_agent",
  "decision",
  "rationale",
  "required_changes",
  "human_approval",
  "decided_at",
  "decision_duration_ms",
];

// ───────────────────────────────────────────────────────────────────────────
// ReviewWriter
// ───────────────────────────────────────────────────────────────────────────

export interface ReviewWriterOptions {
  /**
   * Directory to write `REVIEW-*.md` files into. Created on first write
   * via the atomic-write helper (which calls `mkdir -p` for the parent).
   */
  reviewsDir: string;
}

export class ReviewWriter {
  private readonly _reviewsDir: string;

  constructor(opts: ReviewWriterOptions) {
    this._reviewsDir = opts.reviewsDir;
  }

  /**
   * Write a verdict + markdown body to `<reviewsDir>/<review_id>.md`.
   *
   * @returns absolute filepath of the freshly persisted REVIEW.
   *
   * @throws `ReviewWriteError` when:
   *   - `verdict.review_id` does not match the schema pattern
   *   - the target file already exists (refuse to overwrite)
   *   - the schema's allOf if/then constraints are violated
   *     (`needs_human` without `human_approval`, `needs_changes` without
   *     `required_changes`)
   *   - the underlying atomic-write helper throws
   */
  async write(verdict: ReviewVerdict, body: string): Promise<string> {
    this._validate(verdict);

    const filename = `${verdict.review_id}.md`;
    const filepath = join(this._reviewsDir, filename);

    // Refuse-to-overwrite check. We use stat+ENOENT instead of access(F_OK)
    // because `fs.access` returns void on success — we need the negative
    // signal ("file does not exist") which stat exposes via ENOENT.
    try {
      await fs.stat(filepath);
      throw new ReviewWriteError(
        verdict.review_id,
        `target file already exists at "${filepath}"; ReviewWriter refuses to overwrite`,
      );
    } catch (err) {
      if (err instanceof ReviewWriteError) throw err;
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw new ReviewWriteError(
          verdict.review_id,
          `stat probe failed for "${filepath}": ${
            err instanceof Error ? err.message : String(err)
          }`,
          { cause: err },
        );
      }
      // ENOENT = OK to write. fall through.
    }

    // Build the file contents: `---\n<yaml>\n---\n\n<body>\n`.
    const fileBody = renderReviewMarkdown(verdict, body);

    try {
      await atomicWriteJson(filepath, fileBody);
    } catch (err) {
      // Best-effort: clean the .tmp staging file so a later retry is clean.
      await cleanupTmp(filepath);
      throw new ReviewWriteError(
        verdict.review_id,
        `atomic write failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }

    return filepath;
  }

  /**
   * Convenience: directory the writer is currently configured to use.
   * Exposed so tests / Runtime.start() can log it.
   */
  get reviewsDir(): string {
    return this._reviewsDir;
  }

  // ── private ──────────────────────────────────────────────────────────

  /**
   * Schema-light validation that mirrors review.schema.json's `if/then`
   * + pattern constraints. We deliberately do NOT pull ajv here — the
   * writer is in a fast path (one ReviewEngine emits → one write per
   * settled session), and the runtime's pattern is "validate at the
   * protocol boundary, trust internally" (see types/state.ts rule #1).
   */
  private _validate(verdict: ReviewVerdict): void {
    if (!REVIEW_ID_PATTERN.test(verdict.review_id)) {
      throw new ReviewWriteError(
        verdict.review_id,
        `review_id="${verdict.review_id}" does not match the schema pattern ` +
          `"^REVIEW-\\d{8}-\\d{3}-[A-Z]+-on-TASK-\\d{8}-\\d{3}.*$" ` +
          `(see review.schema.json)`,
      );
    }

    if (verdict.decision === "needs_human" && !verdict.human_approval) {
      throw new ReviewWriteError(
        verdict.review_id,
        `decision="needs_human" requires human_approval (schema allOf #1)`,
      );
    }

    if (
      verdict.decision === "needs_changes" &&
      verdict.required_changes === undefined
    ) {
      throw new ReviewWriteError(
        verdict.review_id,
        `decision="needs_changes" requires required_changes (schema allOf #2)`,
      );
    }

    // Sanity: the parent directory of reviewsDir is consistent.
    if (!this._reviewsDir || dirname(this._reviewsDir) === this._reviewsDir) {
      throw new ReviewWriteError(
        verdict.review_id,
        `reviewsDir="${this._reviewsDir}" is invalid`,
      );
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Pure helpers — exported for tests + the schema-light front-matter shape
// can be unit-tested without filesystem.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Build a YAML-front-matter + markdown-body file body.
 *
 * Output shape:
 *   ---
 *   <yaml>
 *   ---
 *
 *   <body>
 *
 * Trailing newline guaranteed (so `state_history`-style appenders never
 * have to second-guess whether the file ends in `\n`).
 */
export function renderReviewMarkdown(
  verdict: ReviewVerdict,
  body: string,
): string {
  const frontmatter: Record<string, unknown> = { protocol: "fcop" };

  // Stamp fields in stable order so diffs across runs read predictably.
  for (const key of FRONTMATTER_FIELD_ORDER) {
    if (key === "protocol") continue;
    const value = (verdict as unknown as Record<string, unknown>)[key as string];
    if (value !== undefined) frontmatter[key as string] = value;
  }

  const yamlBody = stringifyYaml(frontmatter, {
    // Plain-style strings whenever possible; quote when needed (e.g. ISO
    // timestamps that contain a colon — yaml@^2 handles this automatically).
    lineWidth: 0,
  });

  // yaml.stringify always ends with `\n`; we still defensively strip and
  // re-add to keep `---\n<yaml>\n---` invariant under future yaml versions.
  const yamlBodyTrimmed = yamlBody.replace(/\n+$/, "");

  const mdBody = body.endsWith("\n") ? body : `${body}\n`;

  return `---\n${yamlBodyTrimmed}\n---\n\n${mdBody}`;
}
