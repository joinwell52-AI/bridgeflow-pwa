/**
 * RuntimeBootstrap — owns the synchronous reconciliation flow that runs
 * once at runtime start, before any user-facing request is accepted.
 *
 * Reference:
 *   - `docs/crash-recovery.md` decision 2 (synchronous reconciliation)
 *   - `docs/crash-recovery.md` decision 3 (3-scenario branching)
 *   - `docs/agents/tasks/TASK-20260509-009-PM-to-DEV.md` §必交付 3
 *
 * Sequence (matching TASK-009 §必交付 3 ASCII):
 *
 *   1. _store.loadAll() → records[]
 *      ├─ file missing       → records = []
 *      ├─ parse failed       → throw RuntimeBootstrapError (HARD FAIL)
 *      └─ ok                 → step 2
 *
 *   2. SDK.list() → sdkAgentIds (Set<string>)
 *      for each record:
 *        ├─ sdk_agent_id ∈ sdkAgentIds → SDK.resume(...)
 *        │   ├─ resume ok      → mark reconciled, push to report.success
 *        │   └─ resume failed  → markFailed(record), push to report.failed
 *        └─ sdk_agent_id ∉ sdkAgentIds (orphan_local, decision 3 case X)
 *                              → markFailed(record, "orphaned: ..."),
 *                                push to report.orphaned
 *
 *      for each foreign sdkAgentId (in SDK list, ∄ record) (case Y):
 *                              → push to report.foreign (do NOT take over)
 *
 *   3. stdout one-liner summary (✅ / ⚠️ / 🪦 / 👻 counts)
 *
 *   4. return ReconciliationReport
 *
 * Race-defense: while `run()` is in progress, AgentRegistry.register
 * throws `RuntimeNotReadyError`. We toggle `registry._setBootstrapping`
 * around the whole sequence.
 */

import type { AgentRecord } from "../types/state.ts";
import {
  ReconciliationStrategy,
  type KernelValidationFailureEntry,
  type ReconciliationFailedEntry,
  type ReconciliationForeignEntry,
  type ReconciliationOrphanedEntry,
  type ReconciliationReport,
  type ReconciliationSuccessEntry,
} from "../types/state.ts";
import type { KernelDependencyValidator } from "../skill/KernelDependencyValidator.ts";
import type { MCPInjector } from "../skill/MCPInjector.ts";
import type { AgentRegistry } from "./AgentRegistry.ts";
import type { AgentSdkAdapter } from "./AgentSdkAdapter.ts";
import {
  RegistryWriteError,
  RuntimeBootstrapError,
} from "./errors.ts";
import type { PersistentStore } from "./PersistentStore.ts";

/**
 * Constructor options for `RuntimeBootstrap`. Caller wires the same
 * instances that AgentRegistry uses — RuntimeBootstrap and AgentRegistry
 * share the store / SDK adapter so reconciliation observes the same view
 * the registry will subsequently expose.
 */
export interface RuntimeBootstrapOptions {
  store: PersistentStore;
  sdk: AgentSdkAdapter;
  /**
   * The AgentRegistry instance whose `_setBootstrapping` we toggle.
   * Required so `register()` can race-defense itself during reconcile.
   */
  registry: AgentRegistry;
  /**
   * Optional logger; defaults to `console`. Tests inject a captured logger
   * to assert on the stdout one-liner without polluting test output.
   */
  logger?: Pick<Console, "log" | "warn">;
  /**
   * Phase E (S5) hook. When provided, after reconciliation the bootstrap
   * runs `validateAll(success)` and:
   *
   *   - moves rejected agents from `success[]` → `failed[]` (with
   *     `markFailed` so persistence agrees)
   *   - records each rejection in `kernel_failures[]` for audit
   *
   * When absent (Phase A/B/C/D wiring), the bootstrap behaves exactly
   * as before — `report.kernel_failures` is `[]`. Test scenario 13
   * (TS-7.11) verifies the gating.
   */
  kernelValidator?: KernelDependencyValidator;
  /**
   * Phase E (S5) hook. When provided, after the kernel gate the
   * bootstrap mounts skills for each surviving `success[]` agent
   * (decision Q: sequential `await`, NOT `Promise.all` — stub mode
   * is logger-only and we want stable ordering for test/operator
   * assertions). v0.2 live mode swaps the body to real spawns.
   */
  mcpInjector?: MCPInjector;
}

export class RuntimeBootstrap {
  private readonly _store: PersistentStore;
  private readonly _sdk: AgentSdkAdapter;
  private readonly _registry: AgentRegistry;
  private readonly _logger: Pick<Console, "log" | "warn">;
  private readonly _kernelValidator: KernelDependencyValidator | null;
  private readonly _mcpInjector: MCPInjector | null;

  constructor(opts: RuntimeBootstrapOptions) {
    this._store = opts.store;
    this._sdk = opts.sdk;
    this._registry = opts.registry;
    this._logger = opts.logger ?? console;
    this._kernelValidator = opts.kernelValidator ?? null;
    this._mcpInjector = opts.mcpInjector ?? null;
  }

  /**
   * Execute the full reconciliation sequence. Idempotent — safe to call
   * multiple times (each call re-reads the store and re-queries the SDK).
   *
   * @throws `RuntimeBootstrapError` if `agents.json` cannot be loaded or
   *   parsed (HARD FAIL per decision 2). Caller (`bin/codeflow-runtime`)
   *   should `process.exit(1)`.
   */
  async run(): Promise<ReconciliationReport> {
    const startedAt = new Date().toISOString();
    this._registry._setBootstrapping(true);

    try {
      // Step 1: load PCB.
      let records: AgentRecord[];
      try {
        records = await this._store.loadAll();
      } catch (err) {
        // RegistryWriteError from JsonFileStore covers parse / read failures.
        // Anything else still gets wrapped — HARD FAIL is non-negotiable.
        if (err instanceof RegistryWriteError) {
          throw new RuntimeBootstrapError(
            `agents.json corrupted or unreadable: ${err.message}`,
            { cause: err },
          );
        }
        throw new RuntimeBootstrapError(
          `unexpected failure loading agents.json: ${
            err instanceof Error ? err.message : String(err)
          }`,
          { cause: err },
        );
      }

      // Step 2: query SDK. SDK.list() failure = HARD FAIL per crash-recovery.md
      // decision 2 ("不允许半启动状态"). We translate any uncaught SDK error
      // to RuntimeBootstrapError so the caller's stderr summary stays consistent
      // with the step-1 (agents.json corrupted) failure path. Test scenario 12
      // (TS-2.8 B-path) verifies this propagation.
      let sdkIds: Set<string>;
      try {
        sdkIds = new Set<string>(await this._sdk.list());
      } catch (err) {
        throw new RuntimeBootstrapError(
          `SDK.list() failed during reconciliation: ${
            err instanceof Error ? err.message : String(err)
          }`,
          { cause: err },
        );
      }
      const knownLocalIds = new Set<string>();

      const success: ReconciliationSuccessEntry[] = [];
      const failed: ReconciliationFailedEntry[] = [];
      const orphaned: ReconciliationOrphanedEntry[] = [];
      const foreign: ReconciliationForeignEntry[] = [];

      for (const record of records) {
        const sdkAgentId = record.protocol.sdk_agent_id;
        if (!sdkAgentId) {
          // Defensive: a record with no sdk_agent_id can't be reconciled.
          // Treat as orphaned (record exists, SDK can't possibly resume it).
          await this._safeMarkFailed(
            record.protocol.agent_id,
            "orphaned: record has no sdk_agent_id",
          );
          orphaned.push({
            agent_id: record.protocol.agent_id,
            sdk_agent_id: "(none)",
            strategy: ReconciliationStrategy.ORPHAN_LOCAL,
          });
          continue;
        }
        knownLocalIds.add(sdkAgentId);

        if (sdkIds.has(sdkAgentId)) {
          try {
            await this._sdk.resume(sdkAgentId);
            // Update the record's reconciled_at without going through
            // registry.resume() — registry.resume() would re-call SDK.
            const now = new Date().toISOString();
            const updated: AgentRecord = {
              ...record,
              protocol: {
                ...record.protocol,
                last_active_at: now,
              },
              runtime_last_reconciled_at: now,
            };
            await this._store.upsert(updated);
            success.push({
              agent_id: record.protocol.agent_id,
              sdk_agent_id: sdkAgentId,
            });
          } catch (err) {
            const reason = `resume after crash failed: ${
              err instanceof Error ? err.message : String(err)
            }`;
            await this._safeMarkFailed(record.protocol.agent_id, reason);
            failed.push({
              agent_id: record.protocol.agent_id,
              sdk_agent_id: sdkAgentId,
              reason,
            });
          }
        } else {
          // Decision 3 case X: orphan_local.
          const reason = `orphaned: SDK no longer recognizes sdk_agent_id="${sdkAgentId}"`;
          await this._safeMarkFailed(record.protocol.agent_id, reason);
          orphaned.push({
            agent_id: record.protocol.agent_id,
            sdk_agent_id: sdkAgentId,
            strategy: ReconciliationStrategy.ORPHAN_LOCAL,
          });
        }
      }

      // Decision 3 case Y: ignore_foreign.
      for (const sdkAgentId of sdkIds) {
        if (!knownLocalIds.has(sdkAgentId)) {
          foreign.push({
            sdk_agent_id: sdkAgentId,
            strategy: ReconciliationStrategy.IGNORE_FOREIGN,
          });
        }
      }

      // Decision 3 case Z (drift) — Phase A leaves detection unimplemented.
      const drifted: ReconciliationReport["drifted"] = [];

      // Phase E (decision P): kernel-dep validation runs AFTER the
      // SDK reconcile loop, so we know exactly which records are alive
      // candidates for skill mounting. We loop the success array,
      // demote violators to failed, and stamp `kernel_failures[]` for
      // operator audit. The loop reads `success` while mutating it,
      // so we walk it backwards to keep splicing semantics simple.
      const kernel_failures: KernelValidationFailureEntry[] = [];
      if (this._kernelValidator) {
        const survivingRecords: AgentRecord[] = [];
        for (const record of records) {
          // We need the full record (skills + agent_id) — `success` only
          // holds id pairs. The `records` we loaded in step 1 are the
          // authoritative shape; intersect with `success`.
          if (
            success.some(
              (s) => s.agent_id === record.protocol.agent_id,
            )
          ) {
            survivingRecords.push(record);
          }
        }
        const failures = this._kernelValidator.validateAll(survivingRecords);
        for (const failure of failures) {
          // Demote in success/failed.
          const idx = success.findIndex(
            (s) => s.agent_id === failure.agent_id,
          );
          if (idx >= 0) success.splice(idx, 1);
          const reason =
            `kernel-dep violation (${failure.reason}): ${failure.detail}`;
          await this._safeMarkFailed(failure.agent_id, reason);
          failed.push({
            agent_id: failure.agent_id,
            sdk_agent_id:
              records.find((r) => r.protocol.agent_id === failure.agent_id)
                ?.protocol.sdk_agent_id ?? "(unknown)",
            reason,
          });
          kernel_failures.push({
            agent_id: failure.agent_id,
            reason: failure.reason,
            detail: failure.detail,
          });
        }
      }

      // Phase E (decision Q): mount skills for the survivors. Sequential
      // `await` for stable log ordering; failures are NOT fatal — we
      // log a warning and move on. (A failed mount in stub mode means
      // an operator typo in the registry; in v0.2 live mode it'll
      // mean a child-process spawn failure and the policy will need
      // to firm up.)
      if (this._mcpInjector) {
        for (const entry of success) {
          const record = records.find(
            (r) => r.protocol.agent_id === entry.agent_id,
          );
          if (!record) continue;
          try {
            await this._mcpInjector.mount(record);
          } catch (err) {
            this._logger.warn(
              `[RuntimeBootstrap] mcpInjector.mount failed for ` +
                `agent_id="${entry.agent_id}": ${
                  err instanceof Error ? err.message : String(err)
                }`,
            );
          }
        }
      }

      const finishedAt = new Date().toISOString();
      const report: ReconciliationReport = {
        startedAt,
        finishedAt,
        success,
        failed,
        orphaned,
        foreign,
        drifted,
        kernel_failures,
      };

      this._printSummary(report);
      return report;
    } finally {
      this._registry._setBootstrapping(false);
    }
  }

  /**
   * `markFailed` may itself fail (e.g. disk full). We don't want a write
   * error during reconciliation to cascade into a HARD FAIL — the report
   * is still useful, and the operator will see the warning.
   */
  private async _safeMarkFailed(agentId: string, reason: string): Promise<void> {
    try {
      await this._registry.markFailed(agentId, reason);
    } catch (err) {
      this._logger.warn(
        `[RuntimeBootstrap] failed to persist markFailed for agent_id="${agentId}": ${
          err instanceof Error ? err.message : String(err)
        } (record will reconcile next boot)`,
      );
    }
  }

  private _printSummary(report: ReconciliationReport): void {
    this._logger.log(
      `[RuntimeBootstrap] ✅ ${report.success.length} success / ` +
        `⚠️ ${report.failed.length} failed / ` +
        `🪦 ${report.orphaned.length} orphaned / ` +
        `👻 ${report.foreign.length} foreign` +
        (report.drifted.length > 0
          ? ` / 🌊 ${report.drifted.length} drifted`
          : "") +
        (report.kernel_failures.length > 0
          ? ` / 🚫 ${report.kernel_failures.length} kernel-dep`
          : ""),
    );
  }
}
