/**
 * TaskParser — read + parse a `TASK-*.md` file into front-matter + body.
 *
 * Scope (TASK-20260509-018 §主交付 2):
 *
 * - Front-matter delimiter is `^---\r?\n` matched at the very start of the
 *   file (line 1) and on a line of its own thereafter.
 * - YAML parsing uses the `yaml` npm package (not a hand-rolled parser).
 * - Files WITHOUT front-matter return `{ frontmatter: {}, body: <whole file> }`
 *   — they are NOT errors. This is the only reasonable behavior for files
 *   the watcher might briefly see during a `git checkout` or partial write.
 * - YAML PARSE failures (i.e. front-matter exists but is malformed) DO throw
 *   `TaskParseError`. Callers (TaskDispatcher) catch and log a state_history
 *   `to: parse_failed` entry.
 * - Convenience field accessors (`task_id / sender / recipient / priority /
 *   thread_key / layer`) are typed-coerced if the front-matter has them in
 *   the right shape; otherwise they're `undefined` while the raw value is
 *   preserved in `frontmatter` (lenient mode — TASK-018 §主交付 2 line 113).
 */

import { promises as fs } from "node:fs";
import { basename } from "node:path";
import { parse as parseYaml } from "yaml";

import { TaskParseError } from "../registry/errors.ts";

/** Recognized priority values per FCoP / TASK schema. */
const PRIORITY_VALUES = ["P0", "P1", "P2", "P3"] as const;
type Priority = (typeof PRIORITY_VALUES)[number];

/** Recognized layer values per design doc §3.2 / Agent schema. */
const LAYER_VALUES = ["worker", "governance", "admin"] as const;
type Layer = (typeof LAYER_VALUES)[number];

export interface ParsedTask {
  /** Absolute path the parser was called with. */
  filepath: string;
  /** Just the basename of `filepath`. */
  filename: string;
  /** Raw YAML object after parse — may be `{}` if no front-matter. */
  frontmatter: Record<string, unknown>;
  /** Markdown body AFTER the closing `---`. May be empty string. */
  body: string;

  // Convenience accessors — type-coerced from `frontmatter` when shape matches.
  task_id?: string;
  sender?: string;
  recipient?: string;
  priority?: Priority;
  thread_key?: string;
  layer?: Layer;
}

/** Front-matter delimiter regex — start of file, line of `---`. */
const FRONTMATTER_OPEN = /^---\r?\n/;

/**
 * Find the closing `---` line by scanning manually after the opening
 * delimiter. We can't use a single regex because YAML bodies can contain
 * `---` inside multi-line strings; we want only `---\n` on a line of its
 * own, *after* the opening.
 */
function findClosingDelimiter(
  source: string,
  startIndex: number,
): { yamlBody: string; bodyStart: number } | null {
  // Walk line by line.
  let i = startIndex;
  let lineStart = startIndex;
  while (i < source.length) {
    const nl = source.indexOf("\n", i);
    const lineEnd = nl === -1 ? source.length : nl;
    const line = source.slice(lineStart, lineEnd).replace(/\r$/, "");
    if (line === "---") {
      return {
        yamlBody: source.slice(startIndex, lineStart),
        bodyStart: nl === -1 ? source.length : nl + 1,
      };
    }
    if (nl === -1) break;
    i = nl + 1;
    lineStart = i;
  }
  return null;
}

function pickStringField(
  fm: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = fm[key];
  return typeof v === "string" ? v : undefined;
}

function pickPriority(fm: Record<string, unknown>): Priority | undefined {
  const v = fm["priority"];
  if (typeof v !== "string") return undefined;
  return (PRIORITY_VALUES as readonly string[]).includes(v)
    ? (v as Priority)
    : undefined;
}

function pickLayer(fm: Record<string, unknown>): Layer | undefined {
  const v = fm["layer"];
  if (typeof v !== "string") return undefined;
  return (LAYER_VALUES as readonly string[]).includes(v)
    ? (v as Layer)
    : undefined;
}

export class TaskParser {
  /**
   * Read + parse the file at `filepath`. See module doc for failure modes.
   *
   * @throws `TaskParseError` if the file exists but its front-matter YAML
   *   is malformed. Read errors (ENOENT, EACCES) propagate as-is — the
   *   caller is expected to handle missing-file races itself (via
   *   `TaskFileNotFoundError` in StateHistoryWriter, etc.).
   */
  static async parse(filepath: string): Promise<ParsedTask> {
    const filename = basename(filepath);
    const source = await fs.readFile(filepath, "utf-8");

    // Tolerance #1: no front-matter at all → return whole file as body.
    if (!FRONTMATTER_OPEN.test(source)) {
      return {
        filepath,
        filename,
        frontmatter: {},
        body: source,
      };
    }

    // Find the start of the YAML payload (after the opening `---\n`).
    const openMatch = source.match(FRONTMATTER_OPEN)!;
    const yamlStart = openMatch[0].length;

    const closing = findClosingDelimiter(source, yamlStart);
    if (!closing) {
      // Tolerance #2: opening `---` but no closing one → treat as no
      // front-matter. The watcher might have caught a partial write.
      return {
        filepath,
        filename,
        frontmatter: {},
        body: source,
      };
    }

    let frontmatter: Record<string, unknown>;
    try {
      const parsed = parseYaml(closing.yamlBody);
      frontmatter =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
    } catch (err) {
      throw new TaskParseError(
        filepath,
        `YAML front-matter parse failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
        { cause: err },
      );
    }

    const body = source.slice(closing.bodyStart);

    return {
      filepath,
      filename,
      frontmatter,
      body,
      task_id: pickStringField(frontmatter, "task_id"),
      sender: pickStringField(frontmatter, "sender"),
      recipient: pickStringField(frontmatter, "recipient"),
      priority: pickPriority(frontmatter),
      thread_key: pickStringField(frontmatter, "thread_key"),
      layer: pickLayer(frontmatter),
    };
  }
}
