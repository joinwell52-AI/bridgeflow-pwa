/**
 * PersistentStore — the durability contract for AgentRegistry.
 *
 * Sprint S2 deliverable: interface only. Concrete implementations
 * (filesystem / SQLite / in-memory) land in S3 along with the answers
 * to `docs/crash-recovery.md` decisions 1–3.
 *
 * Reference: design doc `docs/design/codeflow-v2-on-fcop-sdk.md` §2.1
 * subsystem 6 (State Store), §10.2 sprint S3.
 */

import type { AgentRecord } from "../types/state.ts";

/**
 * Atomic key/value store for AgentRecord. One implementation = one storage
 * backend. The default v0.1 backend writes `agents.json` under
 * `.codeflow/state/` (see `crash-recovery.md` decision 1 for "when to flush").
 *
 * Implementations MUST guarantee:
 *
 * - **Atomicity**: a partial `saveAll` MUST NOT leave the store in a
 *   half-written state. (FS impl: write-temp + rename. SQLite: TX.)
 * - **Durability**: after `saveAll` resolves, the data MUST survive a
 *   `kill -9` of the runtime. (FS impl: fsync. SQLite: WAL flushed.)
 * - **Concurrency**: only ONE runtime process owns the store at a time.
 *   Multi-process is out of scope for v0.1.
 */
export interface PersistentStore {
  /**
   * Load every AgentRecord. Used at startup and during full-table dumps.
   *
   * @returns array, possibly empty if first boot.
   * @throws if the underlying file/db is corrupted (not just empty).
   *         The runtime treats this as a hard fail; recovery is manual.
   */
  loadAll(): Promise<AgentRecord[]>;

  /**
   * Persist every AgentRecord. Used by AgentRegistry for full snapshots.
   *
   * @param records full set of records (NOT a delta).
   * @throws if the write cannot be made durable.
   */
  saveAll(records: AgentRecord[]): Promise<void>;

  /**
   * Optional fast-path: write a single record without rewriting everything.
   * Implementations MAY no-op this and force callers to use `saveAll`.
   * The runtime MUST handle the no-op case (i.e. it doesn't depend on
   * `upsertOne` for correctness, only for performance).
   *
   * @param record single record to upsert by `record.protocol.agent_id`.
   */
  upsertOne(record: AgentRecord): Promise<void>;
}

/**
 * Factory marker: each backend exports a `create…Store(opts)` function
 * returning `PersistentStore`. Concrete factories live in `S3+` impl files.
 *
 * Example (S3): `createJsonFileStore({ path: ".codeflow/state/agents.json" })`
 */
export interface PersistentStoreFactory {
  (opts: unknown): PersistentStore;
}
