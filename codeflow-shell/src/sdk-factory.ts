/**
 * SDK adapter factory — picks the right `AgentSdkAdapter` for the
 * environment the shell is starting in.
 *
 * v0.2.0-beta.1 (MT-1 hotfix; full wire-through of cfg.cursor.defaultModel):
 *
 *   - `makeRealCursorSdkAdapter(cfg)` returns a real `CursorSdkAdapter`
 *     IFF `cfg.apiKey` (or `process.env.CURSOR_API_KEY`) is set, else
 *     returns `null` so callers chain `??` to the in-memory fallback.
 *     Now also forwards `cfg.defaultModel` to `CursorSdkAdapterOptions`
 *     so `Agent.create({ model })` and `agent.send({ model })` get a
 *     value when callers don't specify per-task `spec.modelId` (closes
 *     BUG-SDK-001 / QA-009 §五).
 *
 *   - `makeFakeCursorSdkAdapter()` returns the in-memory adapter
 *     (`InMemorySdkAdapter`) — settles agents synthetically via
 *     `setImmediate`, without making any real SDK / network call. Used
 *     by automated tests AND by users who haven't configured a Cursor
 *     API key yet (so first launch still smoke-tests cleanly).
 *
 * References:
 *   - TASK-20260510-002-PM-to-DEV §三 P1 §1 (factory introduced)
 *   - TASK-20260510-010-PM-to-DEV §3.3 (defaultModel wire-through)
 *   - REPORT-20260510-009-QA-to-PM §五 BUG-SDK-001 (root cause)
 */

import {
  CursorSdkAdapter,
  InMemorySdkAdapter,
  type AgentSdkAdapter,
} from "@codeflow/runtime";

/**
 * Subset of `CodeflowConfig.cursor` consumed by this factory.
 * Decoupled from the full `CodeflowConfig` so unit tests can call the
 * factory with a tiny literal object.
 */
export interface CursorAdapterConfig {
  /**
   * Cursor API key. If absent and `process.env.CURSOR_API_KEY` is also
   * absent, this factory returns `null` and the caller falls back to
   * `makeFakeCursorSdkAdapter()`.
   */
  apiKey?: string;
  /**
   * Default model id forwarded to `Agent.create({ model })` and
   * `agent.send({ model })`. **Required for `local` runtime mode** —
   * the SDK rejects local agents at `send()` without an explicit
   * model (see BUG-SDK-001).
   *
   * MT-1 (v0.2.0-beta.1): now wired all the way to
   * `CursorSdkAdapterOptions.defaultModel`. Previously this field
   * was recorded for the banner only — that left `local`-mode users
   * with a 100% failure rate at first task drop.
   */
  defaultModel?: string;
  /**
   * `local` (the v0.1 default — scopes Agent.list to the current cwd) or
   * `cloud` (cross-machine listing). Optional; defaults to `local`.
   */
  listScope?: "local" | "cloud";
}

/**
 * Returns a real `@cursor/sdk`-backed adapter, OR `null` if the SDK
 * isn't reachable (no `apiKey` and no `process.env.CURSOR_API_KEY`).
 *
 * Callers chain `??` to fall back to the in-memory adapter:
 *
 * ```ts
 * const sdk = makeRealCursorSdkAdapter(cfg.cursor) ?? makeFakeCursorSdkAdapter();
 * ```
 */
export function makeRealCursorSdkAdapter(
  cfg: CursorAdapterConfig,
): AgentSdkAdapter | null {
  const apiKey = cfg.apiKey ?? process.env["CURSOR_API_KEY"];
  if (!apiKey) return null;

  // Pass the resolved key explicitly so subsequent `process.env` mutations
  // (e.g., from a long-running process where the env later changes) don't
  // cause a different key to flow into individual SDK calls.
  return new CursorSdkAdapter({
    apiKey,
    listScope: cfg.listScope ?? "local",
    defaultCwd: process.cwd(),
    // MT-1: forward defaultModel so `Agent.create` / `agent.send` see
    // it when the caller doesn't supply `spec.modelId` per-task. We
    // forward the raw value (may be `undefined`); CursorSdkAdapter is
    // responsible for the `?? undefined` semantics in its `??` chain.
    ...(cfg.defaultModel ? { defaultModel: cfg.defaultModel } : {}),
  });
}

/**
 * Returns the in-memory adapter (`InMemorySdkAdapter`) — settles
 * agents synthetically via `setImmediate`, without making any real
 * SDK / network call. Used by:
 *
 *   - Automated tests (94/94 in `@codeflow/runtime`).
 *   - Local smoke tests where no `CURSOR_API_KEY` is present.
 *   - The Hello World demo (so `examples/hello-world/sample-task.md`
 *     drops cleanly even without a Cursor account).
 */
export function makeFakeCursorSdkAdapter(): AgentSdkAdapter {
  return new InMemorySdkAdapter();
}

/**
 * Diagnostic helper for the banner — returns a one-line description
 * of which adapter mode we picked (and why).
 */
export function describeAdapterChoice(
  cfg: CursorAdapterConfig,
  picked: AgentSdkAdapter,
): string {
  const isReal = picked instanceof CursorSdkAdapter;
  if (isReal) {
    const keySource = cfg.apiKey ? "config" : "process.env.CURSOR_API_KEY";
    const modelSuffix = cfg.defaultModel
      ? `, defaultModel="${cfg.defaultModel}"`
      : "";
    return `live (CursorSdkAdapter; apiKey from ${keySource}, listScope="${cfg.listScope ?? "local"}"${modelSuffix})`;
  }
  return "fake (InMemorySdkAdapter; CURSOR_API_KEY not set — set it in ~/.codeflow/v2/.env or config.json to use real SDK)";
}
