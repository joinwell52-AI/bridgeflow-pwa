/**
 * InboxWatcher — chokidar-backed file-add doorbell for the task inbox.
 *
 * Scope (TASK-20260509-018 §主交付 1):
 *
 * - Watch ONE directory (default `docs/agents/tasks/`), depth=0 (no recurse).
 *   The repo currently lays Task files flat — the §2.4 reference impl in the
 *   design doc uses per-role subdirs, but adopting that is a v0.x+ migration
 *   (TASK-018 §不做 line 328 "保持现状平铺，不破坏").
 * - Only emit on `add`. `change` / `unlink` are ignored — Task files are
 *   append-only by codeflow-project rule, and a `change` event would just be
 *   the StateHistoryWriter's own `appendFile` reflecting back through chokidar.
 * - File-name regex matches the task signature only:
 *     /^TASK-\d{8}-\d{3}-[A-Za-z]+-to-[A-Za-z]+\.md$/
 *   so REPORT-*.md / HANDOFF-*.md / generic markdown don't ring the doorbell.
 * - Handler errors are isolated: the watcher CANNOT die because one
 *   handler threw. We wrap each invocation in `Promise.resolve().catch(...)`
 *   and forward the error to the optional logger (default = console.error).
 *
 * Reference:
 * - design doc `docs/design/codeflow-v2-on-fcop-sdk.md` §2.4 (reference impl)
 * - TASK-20260509-018 §主交付 1 implementation points
 */

import { resolve as resolvePath } from "node:path";
import chokidar from "chokidar";
import type { FSWatcher } from "chokidar";

/** Default file-name regex — task signature only. */
const DEFAULT_TASK_FILE_REGEX =
  /^TASK-\d{8}-\d{3}-[A-Za-z]+-to-[A-Za-z]+\.md$/;

export interface InboxWatcherOpts {
  /** Directory to watch. Default behavior: caller passes the absolute path. */
  dir: string;
  /**
   * If true, the chokidar watcher fires `add` for every existing file at
   * startup. We default to `true` (= ignoreInitial) so a runtime restart
   * does not re-dispatch every existing task. Phase C E2E demo flips this
   * for a "drain inbox on startup" mode (deferred to Phase C+1).
   */
  ignoreInitial?: boolean;
  /** Override the default task-file regex. Mostly for tests. */
  fileNamePattern?: RegExp;
  /**
   * Optional logger; default = `console`. Tests inject a no-op logger to
   * silence handler-error warnings.
   */
  logger?: {
    warn: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, ...args: unknown[]) => void;
  };
}

/** Discriminated event passed to handlers. v0.1 only emits `task_added`. */
export interface InboxEvent {
  kind: "task_added";
  /** Absolute filesystem path to the task file. */
  filepath: string;
  /** Just the basename (e.g. `TASK-20260509-001-PM-to-DEV.md`). */
  filename: string;
  /** Sender role parsed from the filename (e.g. `PM`, `ADMIN`). */
  sender: string;
  /** Recipient role parsed from the filename (e.g. `DEV`, `OPS`). */
  recipient: string;
}

export type InboxEventHandler = (event: InboxEvent) => void | Promise<void>;

/** Parse `TASK-YYYYMMDD-NNN-XXX-to-YYY.md` → `{sender: XXX, recipient: YYY}`. */
function parseSenderRecipient(filename: string): {
  sender: string;
  recipient: string;
} | null {
  // Filename ends with .md; strip then split.
  const base = filename.replace(/\.md$/, "");
  const parts = base.split("-");
  // Expected: ["TASK", "YYYYMMDD", "NNN", sender, "to", recipient]
  if (parts.length < 6) return null;
  if (parts[0] !== "TASK") return null;
  if (parts[parts.length - 2] !== "to") return null;
  const sender = parts[parts.length - 3];
  const recipient = parts[parts.length - 1];
  if (!sender || !recipient) return null;
  return { sender, recipient };
}

export class InboxWatcher {
  private readonly _dir: string;
  private readonly _ignoreInitial: boolean;
  private readonly _fileNamePattern: RegExp;
  private readonly _logger: NonNullable<InboxWatcherOpts["logger"]>;

  private _watcher: FSWatcher | null = null;
  private _started = false;
  private readonly _handlers = new Set<InboxEventHandler>();

  constructor(opts: InboxWatcherOpts) {
    this._dir = resolvePath(opts.dir);
    this._ignoreInitial = opts.ignoreInitial ?? true;
    this._fileNamePattern = opts.fileNamePattern ?? DEFAULT_TASK_FILE_REGEX;
    this._logger = opts.logger ?? {
      warn: (msg, ...args) => console.warn(msg, ...args),
      error: (msg, ...args) => console.error(msg, ...args),
    };
  }

  /** Absolute watch directory (resolved at construction time). */
  get dir(): string {
    return this._dir;
  }

  /**
   * Start watching. Resolves once chokidar's `ready` event fires (initial
   * scan complete). Calling twice is an error — the watcher is single-use
   * per construction.
   */
  async start(): Promise<void> {
    if (this._started) {
      throw new Error("InboxWatcher.start() already called");
    }
    this._started = true;

    this._watcher = chokidar.watch(this._dir, {
      ignoreInitial: this._ignoreInitial,
      depth: 0,
      // Persistent keeps Node's event loop alive while watching — desired
      // for a long-running runtime, but tests `await stop()` to release it.
      persistent: true,
      // Treat non-existent dir as "create lazily" — chokidar 4 emits ready
      // even if the dir doesn't exist yet, then fires `add` once it does.
      ignorePermissionErrors: true,
      // De-bounce double-`add` events. On Windows + NTFS, chokidar can
      // observe a file twice when the writer creates+populates in two
      // syscalls (open → write → close); awaitWriteFinish coalesces by
      // waiting until the file's size has been stable for stabilityThreshold.
      // 80ms covers fast Node writes; 30ms poll keeps perceived latency low.
      awaitWriteFinish: {
        stabilityThreshold: 80,
        pollInterval: 30,
      },
    });

    this._watcher.on("add", (filepath) => this._onAdd(filepath));
    this._watcher.on("error", (err) => {
      this._logger.error(
        `[InboxWatcher] chokidar error: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });

    await new Promise<void>((resolve, reject) => {
      const w = this._watcher!;
      const onReady = (): void => {
        w.off("error", onError);
        resolve();
      };
      const onError = (err: unknown): void => {
        w.off("ready", onReady);
        reject(err);
      };
      w.once("ready", onReady);
      w.once("error", onError);
    });
  }

  /**
   * Subscribe to inbox events. Returns an unsubscribe function. Handlers
   * are called serially per event; a slow async handler delays nothing
   * (we don't await the handler before calling the next subscriber, so
   * one slow listener can't starve another).
   */
  onEvent(handler: InboxEventHandler): () => void {
    this._handlers.add(handler);
    return () => {
      this._handlers.delete(handler);
    };
  }

  /**
   * Gracefully close the underlying chokidar watcher (releases fd / OS
   * watch handles). Safe to call before `start()` (no-op) or twice
   * (second call no-op).
   */
  async stop(): Promise<void> {
    if (!this._watcher) return;
    const w = this._watcher;
    this._watcher = null;
    await w.close();
  }

  // ── private ──────────────────────────────────────────────────────────

  private _onAdd(filepath: string): void {
    const filename = filepath.split(/[\\/]/).pop() ?? filepath;
    if (!this._fileNamePattern.test(filename)) {
      // Strict regex match — non-task files (REPORT-*.md, HANDOFF-*.md,
      // hidden dotfiles) are silently dropped. This is the only correct
      // behavior; logging would spam during normal repo activity.
      return;
    }
    const parsed = parseSenderRecipient(filename);
    if (!parsed) {
      // The regex matched but the structural split failed — should never
      // happen if the regex is correct, but defend against custom patterns.
      this._logger.warn(
        `[InboxWatcher] filename matched regex but failed sender/recipient parse: ${filename}`,
      );
      return;
    }

    const event: InboxEvent = {
      kind: "task_added",
      filepath,
      filename,
      sender: parsed.sender,
      recipient: parsed.recipient,
    };

    for (const handler of [...this._handlers]) {
      // Fire-and-forget with error isolation. We do NOT await here:
      // a slow handler must not delay sibling handlers. If callers want
      // ordering, they can chain inside a single handler.
      Promise.resolve()
        .then(() => handler(event))
        .catch((err) => {
          this._logger.error(
            `[InboxWatcher] handler threw on ${event.filename}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
    }
  }
}
