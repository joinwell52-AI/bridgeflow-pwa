/**
 * InboxWatcher tests — Phase C TS-5.1 / TS-5.2 / TS-5.3.
 *
 * Scope:
 *   - TS-5.1: chokidar `add` event for a TASK-*.md fires the handler
 *   - TS-5.2: REPORT-*.md / HANDOFF-*.md / arbitrary .md are silently ignored
 *   - TS-5.3: a throwing handler does NOT take the watcher down; peer
 *     handlers / subsequent events still fire.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { InboxWatcher, type InboxEvent } from "../InboxWatcher.ts";
import { quietLogger, waitFor, withTempScheduler } from "./helpers.ts";

const VALID_TASK_BODY = `---
protocol: fcop
task_id: TASK-20260509-001-PM-to-DEV
sender: PM
recipient: DEV
priority: P2
status: pending
---

# A task body
`;

describe("InboxWatcher", () => {
  it("TS-5.1: fires handler on add of a TASK-*.md file", async () => {
    await withTempScheduler(async ({ inboxDir }) => {
      const watcher = new InboxWatcher({ dir: inboxDir, logger: quietLogger() });
      const events: InboxEvent[] = [];
      watcher.onEvent((evt) => {
        events.push(evt);
      });
      try {
        await watcher.start();

        await writeFile(
          join(inboxDir, "TASK-20260509-001-PM-to-DEV.md"),
          VALID_TASK_BODY,
        );

        const got = await waitFor(() => events[0], {
          what: "first task_added event",
          timeoutMs: 4000,
        });

        assert.equal(got.kind, "task_added");
        assert.equal(got.filename, "TASK-20260509-001-PM-to-DEV.md");
        assert.equal(got.sender, "PM");
        assert.equal(got.recipient, "DEV");
        assert.ok(got.filepath.endsWith("TASK-20260509-001-PM-to-DEV.md"));
      } finally {
        await watcher.stop();
      }
    });
  });

  it("TS-5.2: ignores REPORT-*.md, HANDOFF-*.md, and arbitrary .md files", async () => {
    await withTempScheduler(async ({ inboxDir }) => {
      const logger = quietLogger();
      const watcher = new InboxWatcher({ dir: inboxDir, logger });
      const events: InboxEvent[] = [];
      watcher.onEvent((evt) => {
        events.push(evt);
      });
      try {
        await watcher.start();

        await writeFile(
          join(inboxDir, "REPORT-20260509-001-DEV-to-PM.md"),
          VALID_TASK_BODY,
        );
        await writeFile(
          join(inboxDir, "HANDOFF-20260509-001-PM-to-OPS.md"),
          VALID_TASK_BODY,
        );
        await writeFile(join(inboxDir, "random-notes.md"), "hello");

        // Now drop ONE valid TASK file to confirm the watcher is alive.
        await writeFile(
          join(inboxDir, "TASK-20260509-002-PM-to-DEV.md"),
          VALID_TASK_BODY,
        );

        const got = await waitFor(() => events[0], { timeoutMs: 4000 });
        assert.equal(events.length, 1);
        assert.equal(got.filename, "TASK-20260509-002-PM-to-DEV.md");
        // No warnings should have been logged for the silently-ignored peers.
        assert.equal(logger.warns.length, 0);
      } finally {
        await watcher.stop();
      }
    });
  });

  it("TS-5.3: a throwing handler does not take the watcher down", async () => {
    await withTempScheduler(async ({ inboxDir }) => {
      const logger = quietLogger();
      const watcher = new InboxWatcher({ dir: inboxDir, logger });
      const peerEvents: InboxEvent[] = [];
      let throwingCalls = 0;

      const throwingHandler = (): void => {
        throwingCalls += 1;
        throw new Error("boom");
      };
      watcher.onEvent(throwingHandler);
      watcher.onEvent((evt) => {
        peerEvents.push(evt);
      });
      try {
        await watcher.start();

        await writeFile(
          join(inboxDir, "TASK-20260509-001-PM-to-DEV.md"),
          VALID_TASK_BODY,
        );
        await writeFile(
          join(inboxDir, "TASK-20260509-002-PM-to-OPS.md"),
          VALID_TASK_BODY,
        );

        await waitFor(() => peerEvents.length >= 2, { timeoutMs: 4000 });

        assert.equal(peerEvents.length, 2);
        assert.equal(throwingCalls, 2);
        // Two errors should have been logged via the watcher's logger.
        assert.ok(
          logger.errors.some((s) => s.includes("handler threw")),
          `expected an error log mentioning "handler threw"; got: ${logger.errors.join(" / ")}`,
        );
      } finally {
        await watcher.stop();
      }
    });
  });
});
