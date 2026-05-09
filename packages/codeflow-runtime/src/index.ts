/**
 * @codeflow/runtime — public API surface (Sprint S3 Phase C).
 *
 * What's exported:
 *   - AgentRegistry + RuntimeBootstrap + PersistentStore + AgentSdkAdapter
 *     (§2.1 subsystem 3 + 6; Sprint S3 Phase A done — `407cfa5` checkpoint)
 *   - SessionManager + SessionStore + TranscriptWriter + SdkRunHandle
 *     (§2.1 subsystem 1 + decision 4 right-half; Sprint S3 Phase B — `8c49907` checkpoint)
 *   - InboxWatcher + TaskParser + StateHistoryWriter + TaskDispatcher + Runtime
 *     (§2.4 doorbell + §3.3 task lifecycle; Sprint S3 Phase C — this commit)
 *   - State types (runtime-private; layered on @codeflow/protocol)
 *
 * What's NOT here (and why):
 *   - Skill Runtime           → S5, `@codeflow/skill-runtime`
 *   - Review Engine           → S4, `@codeflow/review-engine`
 *   - codeflow-shell EXE      → S6 (Node SEA bundle that imports `Runtime`)
 *   - Mobile Console / relay  → v0.2 (separate effort)
 *   - Cloud agent runtime     → v0.x; binding-mode field exists, but
 *                               local-only is the v0.1 reality
 *
 * See `README.md` for the full sprint roadmap and `docs/crash-recovery.md`
 * for the 4 persistence/recovery decisions.
 */

export {
  AgentRegistry,
  type AgentRegistryFilter,
  type AgentRegistryOptions,
  type PersistentStore,
  JsonFileStore,
  type JsonFileStoreOptions,
  type AgentSdkAdapter,
  type AgentCreateSpec,
  type AgentSendSpec,
  CursorSdkAdapter,
  type CursorSdkAdapterOptions,
  InMemorySdkAdapter,
  InMemoryRunHandle,
  type InMemoryRunHandleOptions,
  InMemorySdkPlantedError,
  ValidationError,
  LayerViolationError,
  AgentNotFoundError,
  RegistryWriteError,
  RuntimeBootstrapError,
  RuntimeNotReadyError,
  SessionNotFoundError,
  InvalidAgentStatusError,
  RuntimeBootstrap,
  type RuntimeBootstrapOptions,
} from "./registry/index.ts";

export {
  SessionManager,
  type SessionManagerOptions,
  type SessionStartPayload,
  type SessionHandle,
  type EmergencyStopResult,
  SessionStore,
  type SessionStoreOptions,
  TranscriptWriter,
  type TranscriptWriterOptions,
  type TranscriptEntryKind,
  SdkRunHandle,
  type SdkRunHandleOptions,
  type SdkRunLike,
  type RunHandle,
} from "./session/index.ts";

export {
  InboxWatcher,
  type InboxEvent,
  type InboxEventHandler,
  type InboxWatcherOpts,
  TaskParser,
  type ParsedTask,
  StateHistoryWriter,
  type StateHistoryEntry,
  TaskDispatcher,
  type TaskDispatcherLogger,
  type TaskDispatcherOpts,
  TaskParseError,
  TaskFileNotFoundError,
} from "./scheduler/index.ts";

export {
  Runtime,
  type RuntimeCreateOptions,
  type RuntimeBootstrapResult,
} from "./Runtime.ts";

export type {
  AgentRecord,
  SessionRecord,
  RuntimeBindingMode,
  AgentFailure,
  RuntimeEvent,
  RuntimeEventType,
  Unsubscribe,
  ReconciliationReport,
  ReconciliationSuccessEntry,
  ReconciliationFailedEntry,
  ReconciliationOrphanedEntry,
  ReconciliationForeignEntry,
  ReconciliationDriftEntry,
} from "./types/state.ts";

export { ReconciliationStrategy } from "./types/state.ts";
