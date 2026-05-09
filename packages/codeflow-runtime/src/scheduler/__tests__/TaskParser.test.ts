/**
 * TaskParser tests — Phase C TS-5.4 / TS-5.5 / TS-5.6.
 *
 * Scope:
 *   - TS-5.4: a well-formed TASK file parses front-matter + body correctly
 *   - TS-5.5: a file with no front-matter returns `frontmatter: {}` (not throws)
 *   - TS-5.6: malformed YAML throws `TaskParseError` with `cause` chain
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { TaskParser } from "../TaskParser.ts";
import { TaskParseError } from "../../registry/errors.ts";
import { withTempScheduler } from "./helpers.ts";

describe("TaskParser", () => {
  it("TS-5.4: parses well-formed front-matter + body", async () => {
    await withTempScheduler(async ({ inboxDir }) => {
      const path = join(inboxDir, "TASK-20260509-001-PM-to-DEV.md");
      const body = `---
protocol: fcop
task_id: TASK-20260509-001-PM-to-DEV
sender: PM
recipient: DEV
priority: P1
thread_key: example-thread
layer: worker
status: pending
---

# Body line 1
Body line 2
`;
      await writeFile(path, body);

      const parsed = await TaskParser.parse(path);
      assert.equal(parsed.task_id, "TASK-20260509-001-PM-to-DEV");
      assert.equal(parsed.sender, "PM");
      assert.equal(parsed.recipient, "DEV");
      assert.equal(parsed.priority, "P1");
      assert.equal(parsed.thread_key, "example-thread");
      assert.equal(parsed.layer, "worker");
      assert.equal(parsed.frontmatter["protocol"], "fcop");
      assert.match(parsed.body, /# Body line 1/);
      assert.match(parsed.body, /Body line 2/);
      // Body must NOT contain the closing `---` delimiter.
      assert.ok(!parsed.body.startsWith("---"));
    });
  });

  it("TS-5.5: tolerates a file with no front-matter", async () => {
    await withTempScheduler(async ({ inboxDir }) => {
      const path = join(inboxDir, "TASK-20260509-002-PM-to-DEV.md");
      await writeFile(path, "# just a body, no yaml block\n");

      const parsed = await TaskParser.parse(path);
      assert.deepEqual(parsed.frontmatter, {});
      assert.equal(parsed.task_id, undefined);
      assert.equal(parsed.priority, undefined);
      assert.equal(parsed.body, "# just a body, no yaml block\n");
    });
  });

  it("TS-5.6: throws TaskParseError on malformed YAML front-matter", async () => {
    await withTempScheduler(async ({ inboxDir }) => {
      const path = join(inboxDir, "TASK-20260509-003-PM-to-DEV.md");
      // Unbalanced quote inside a string value will trip the YAML parser.
      const body = `---
protocol: fcop
task_id: "TASK-20260509-003-PM-to-DEV
sender: PM
---

# body
`;
      await writeFile(path, body);

      await assert.rejects(
        () => TaskParser.parse(path),
        (err) => {
          assert.ok(err instanceof TaskParseError);
          assert.equal((err as TaskParseError).filepath, path);
          assert.match(
            (err as Error).message,
            /YAML front-matter parse failed/,
          );
          // Cause chain preserved (the underlying yaml-package error).
          assert.ok((err as TaskParseError).cause !== undefined);
          return true;
        },
      );
    });
  });

  it("bonus: tolerates an opening --- without a closing ---", async () => {
    await withTempScheduler(async ({ inboxDir }) => {
      const path = join(inboxDir, "TASK-20260509-004-PM-to-DEV.md");
      // Half-written file caught by the watcher mid-edit.
      await writeFile(path, "---\nprotocol: fcop\nsender: PM\n");

      const parsed = await TaskParser.parse(path);
      assert.deepEqual(parsed.frontmatter, {});
      assert.equal(parsed.task_id, undefined);
    });
  });
});
