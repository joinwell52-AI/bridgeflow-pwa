/**
 * Public barrel for the scheduler layer (Sprint S3 Phase C).
 *
 * Mirrors `registry/index.ts` and `session/index.ts` — re-exports the
 * scheduler-side classes, types, and errors that consumers (Runtime.ts,
 * E2E demo, future S4 Skill Runtime) need.
 */

export {
  InboxWatcher,
  type InboxEvent,
  type InboxEventHandler,
  type InboxWatcherOpts,
} from "./InboxWatcher.ts";

export { TaskParser, type ParsedTask } from "./TaskParser.ts";

export {
  StateHistoryWriter,
  type StateHistoryEntry,
} from "./StateHistoryWriter.ts";

export {
  TaskDispatcher,
  type TaskDispatcherLogger,
  type TaskDispatcherOpts,
} from "./TaskDispatcher.ts";

// Scheduler-layer errors live in registry/errors.ts (Phase B decision J).
// Re-export here for ergonomic single-import consumers.
export {
  TaskParseError,
  TaskFileNotFoundError,
} from "../registry/errors.ts";
