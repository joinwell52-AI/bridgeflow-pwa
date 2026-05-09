/**
 * SDK adapter factory — picks the right `AgentSdkAdapter` for the
 * environment the shell is starting in.
 *
 * v0.1.0-rc.1 (internal RC) ALWAYS uses `InMemorySdkAdapter`:
 *
 *   - The "real" `CursorSdkAdapter` exists in @codeflow/runtime but
 *     requires a live `@cursor/sdk` connection; v0.1 ADMIN test runs
 *     do not need real SDK calls (the goal is "internal try-out of
 *     the protocol mechanics" — agents fake-settle on InMemoryRunHandle's
 *     setImmediate).
 *
 *   - `makeRealCursorSdkAdapter()` returns `null` in v0.1; v0.2 will
 *     wire the real SDK after the @cursor/sdk surface stabilizes
 *     (currently blocked on doorbell primitive landing — see design
 *     doc §0.6 + Cursor forum issue #158480).
 *
 *   - The `null ?? InMemorySdkAdapter` chain is intentional: it leaves
 *     a single-line v0.2 swap point.
 */

import type { AgentSdkAdapter } from "@codeflow/runtime";
import { InMemorySdkAdapter } from "@codeflow/runtime";

/**
 * Returns a real `@cursor/sdk`-backed adapter, OR `null` if the SDK
 * isn't ready / configured for v0.1. Callers chain `??` to fall back
 * to the in-memory adapter.
 *
 * v0.1.0-rc.1: always returns `null` (real SDK is v0.2 work).
 */
export function makeRealCursorSdkAdapter(): AgentSdkAdapter | null {
  // Intentionally a stub — see §file header. v0.2 will replace this
  // with `new CursorSdkAdapter({ apiKey: process.env.CURSOR_API_KEY })`
  // (or similar; awaits @cursor/sdk surface lock).
  return null;
}

/**
 * Returns the in-memory adapter (`InMemorySdkAdapter`) — settles
 * agents synthetically via `setImmediate`, without making any real
 * SDK / network call. Used by the v0.1 internal RC so ADMIN can
 * try out the protocol mechanics end-to-end without configuring a
 * Cursor account.
 */
export function makeFakeCursorSdkAdapter(): AgentSdkAdapter {
  return new InMemorySdkAdapter();
}
