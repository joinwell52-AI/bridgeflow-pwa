/**
 * Runtime — high-level composition root for the CodeFlow AI Runtime.
 *
 * Sprint S3 Phase C ships this as a thin convenience wrapper that wires
 * together the 8 subsystems an end-to-end demo (or the future
 * `codeflow-shell` EXE) needs:
 *
 *   PersistentStore (agents.json)
 *     → AgentRegistry
 *     → RuntimeBootstrap (run once at construction)
 *     → SessionStore (per-session JSON)
 *     → TranscriptWriter (per-run markdown)
 *     → SessionManager
 *     → InboxWatcher (chokidar)
 *     → StateHistoryWriter
 *     → TaskDispatcher (glue)
 *
 * Reference:
 *   - TASK-20260509-018 §主交付 5b (this file)
 *   - design doc §0.8.3 (Hello World demo) and §10.2 (sprint roadmap)
 *
 * What this file deliberately is NOT:
 *
 *   - A long-lived daemon entry point. That's `codeflow-shell` (S6).
 *     Runtime.ts is a building block; the daemon binary will import it
 *     and add SIGTERM/SIGINT trapping, log routing, etc.
 *   - A multi-tenant orchestrator. v0.1 = single PC, single workspace.
 *   - A CLI argument parser. Caller passes options as a typed object.
 */

import { join } from "node:path";

import { AgentRegistry } from "./registry/AgentRegistry.ts";
import type { AgentSdkAdapter } from "./registry/AgentSdkAdapter.ts";
import {
  JsonFileStore,
  type PersistentStore,
} from "./registry/PersistentStore.ts";
import { RuntimeBootstrap } from "./registry/RuntimeBootstrap.ts";
import {
  InboxWatcher,
  StateHistoryWriter,
  TaskDispatcher,
  type TaskDispatcherLogger,
} from "./scheduler/index.ts";
import { SessionManager } from "./session/SessionManager.ts";
import { SessionStore } from "./session/SessionStore.ts";
import { TranscriptWriter } from "./session/TranscriptWriter.ts";
import type { ReconciliationReport } from "./types/state.ts";

export interface RuntimeCreateOptions {
  /**
   * SDK adapter (real `CursorSdkAdapter` for production, `InMemorySdkAdapter`
   * for the Phase C E2E demo). Caller owns construction so they can plant
   * a fixture roster ahead of time.
   */
  sdkAdapter: AgentSdkAdapter;
  /**
   * Directory that owns runtime persistence (agents.json + sessions/ +
   * transcripts/). Default: `.codeflow/state` rooted at process.cwd().
   *
   * Sub-paths derived from this:
   *   <persistDir>/agents.json
   *   <persistDir>/sessions/<session_id>.json
   *   <persistDir>/transcripts/<run_id>.md
   */
  persistDir: string;
  /**
   * Directory the InboxWatcher monitors. Default: `docs/agents/tasks/`
   * relative to process.cwd().
   */
  inboxDir: string;
  /** Optional logger override forwarded to TaskDispatcher + Bootstrap. */
  logger?: TaskDispatcherLogger;
}

export interface RuntimeBootstrapResult {
  report: ReconciliationReport;
}

/**
 * Composed runtime. Opaque-ish to callers: most code only needs
 * `.start()` / `.stop()`. The public sub-systems are exposed as
 * read-only fields for tests and for the demo to register agents.
 */
export class Runtime {
  /** Reconciliation report from the constructor's RuntimeBootstrap.run(). */
  public readonly bootstrap: RuntimeBootstrapResult;

  public readonly store: PersistentStore;
  public readonly registry: AgentRegistry;
  public readonly sessionStore: SessionStore;
  public readonly transcriptWriter: TranscriptWriter;
  public readonly sessionManager: SessionManager;
  public readonly historyWriter: StateHistoryWriter;
  public readonly watcher: InboxWatcher;
  public readonly dispatcher: TaskDispatcher;

  private constructor(parts: {
    bootstrap: RuntimeBootstrapResult;
    store: PersistentStore;
    registry: AgentRegistry;
    sessionStore: SessionStore;
    transcriptWriter: TranscriptWriter;
    sessionManager: SessionManager;
    historyWriter: StateHistoryWriter;
    watcher: InboxWatcher;
    dispatcher: TaskDispatcher;
  }) {
    this.bootstrap = parts.bootstrap;
    this.store = parts.store;
    this.registry = parts.registry;
    this.sessionStore = parts.sessionStore;
    this.transcriptWriter = parts.transcriptWriter;
    this.sessionManager = parts.sessionManager;
    this.historyWriter = parts.historyWriter;
    this.watcher = parts.watcher;
    this.dispatcher = parts.dispatcher;
  }

  /**
   * Compose all sub-systems and run RuntimeBootstrap.
   *
   * After this resolves the runtime is "ready" but NOT yet listening for
   * inbox events — call `.start()` to engage the dispatcher.
   *
   * @throws `RuntimeBootstrapError` if `agents.json` is corrupt or
   *   `SDK.list()` fails (HARD FAIL per crash-recovery.md decision 2).
   */
  static async create(opts: RuntimeCreateOptions): Promise<Runtime> {
    const agentsJsonPath = join(opts.persistDir, "agents.json");
    const sessionsDir = join(opts.persistDir, "sessions");
    const transcriptsDir = join(opts.persistDir, "transcripts");

    // --- registry layer ---
    const store = new JsonFileStore({ path: agentsJsonPath });
    const registry = new AgentRegistry({ store, sdk: opts.sdkAdapter });
    const bootstrap = new RuntimeBootstrap({
      store,
      sdk: opts.sdkAdapter,
      registry,
    });
    const report = await bootstrap.run();

    // --- session layer ---
    const sessionStore = new SessionStore({ dir: sessionsDir });
    const transcriptWriter = new TranscriptWriter({ dir: transcriptsDir });
    const sessionManager = new SessionManager({
      registry,
      sdk: opts.sdkAdapter,
      sessionStore,
      transcriptWriter,
    });

    // --- scheduler layer ---
    const historyWriter = new StateHistoryWriter();
    const watcher = new InboxWatcher({ dir: opts.inboxDir });
    const dispatcher = new TaskDispatcher({
      watcher,
      historyWriter,
      registry,
      sessionManager,
      ...(opts.logger ? { logger: opts.logger } : {}),
    });

    return new Runtime({
      bootstrap: { report },
      store,
      registry,
      sessionStore,
      transcriptWriter,
      sessionManager,
      historyWriter,
      watcher,
      dispatcher,
    });
  }

  /**
   * Start the dispatcher (which starts the watcher under the hood).
   * After this resolves, dropping a `TASK-*.md` into the inbox dir will
   * trigger the full pipeline.
   */
  async start(): Promise<void> {
    await this.dispatcher.start();
  }

  /**
   * Gracefully stop the dispatcher (releases watcher fd, unsubscribes
   * pending session listeners). Does NOT cancel running sessions —
   * callers wanting that should call
   * `runtime.sessionManager.cancelAllForEmergencyStop()` first.
   */
  async stop(): Promise<void> {
    await this.dispatcher.stop();
  }
}
