/**
 * @codeflow/runtime — public API surface (Sprint S2 skeleton).
 *
 * What's exported:
 *   - AgentRegistry + types  (§2.1 subsystem 3 contract; method bodies S3+)
 *   - SessionManager + types (§2.1 subsystem 1 contract; method bodies S3+)
 *   - State types            (runtime-private types layered on @codeflow/protocol)
 *
 * What's NOT here (and why):
 *   - Task Scheduler          → S3, separate package `@codeflow/scheduler`
 *   - Skill Runtime           → S5, separate package `@codeflow/skill-runtime`
 *   - Review Engine ⭐         → S4, separate package `@codeflow/review-engine`
 *   - Mobile Console / relay  → v0.2 (separate effort)
 *   - Cloud agent runtime     → v0.x; S2 leaves the binding-mode field in
 *                               place but local-only is the v0.1 reality
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
  CursorSdkAdapter,
  type CursorSdkAdapterOptions,
  InMemorySdkAdapter,
  InMemorySdkPlantedError,
  ValidationError,
  LayerViolationError,
  AgentNotFoundError,
  RegistryWriteError,
  RuntimeBootstrapError,
  RuntimeNotReadyError,
  RuntimeBootstrap,
  type RuntimeBootstrapOptions,
} from "./registry/index.ts";

export {
  SessionManager,
  type SessionManagerOptions,
  type SessionStartPayload,
  type SessionHandle,
  type EmergencyStopResult,
  type RunHandle,
} from "./session/index.ts";

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
