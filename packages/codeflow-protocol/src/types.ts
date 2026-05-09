/**
 * CodeFlow Runtime Protocol — TypeScript type mirror of the 5 JSON schemas
 * under `packages/codeflow-protocol/schemas/`.
 *
 * SCOPE & RULES (READ BEFORE EDITING):
 *
 * - These types are a hand-maintained 1:1 mirror of the JSON Schemas.
 *   The JSON Schemas in `schemas/` are the SINGLE SOURCE OF TRUTH;
 *   these TS types are a *consumer convenience* for downstream packages.
 *
 * - DO NOT add fields here that do not exist in the corresponding schema.
 *   Per design doc §8.0 Hard Rule #4, ANY schema evolution must originate
 *   in the `D:\FCoP` repository (https://github.com/joinwell52-AI/FCoP),
 *   propagate to `packages/codeflow-protocol/schemas/*.json` after upstream
 *   review, and only then be reflected here. Single-side forks are forbidden.
 *
 * - DO NOT loosen field types beyond what schemas allow (e.g. don't widen
 *   an enum to `string`). If you find a schema mismatch, file an Issue
 *   in `D:\FCoP` first; do not fix it locally.
 *
 * - When schemas change, refresh this file by re-reading the schemas line
 *   by line. We deliberately don't auto-generate yet (json-schema-to-typescript
 *   tooling is a v0.x.+ choice, see design doc §3.7).
 *
 * Reference: design doc `docs/design/codeflow-v2-on-fcop-sdk.md` §3.2 – §3.6
 */

// ───────────────────────────────────────────────────────────────────────────
// Shared primitives
// ───────────────────────────────────────────────────────────────────────────

/** ISO-8601 date-time string. JSON Schema `format: "date-time"`. */
export type IsoDateTime = string;

/** Risk level enum, used by Task and Skill tools. See §0.9.4. */
export type RiskLevel = "low" | "medium" | "high" | "irreversible";

// ───────────────────────────────────────────────────────────────────────────
// §3.2 Agent Schema  (mirror of schemas/agent.schema.json)
// ───────────────────────────────────────────────────────────────────────────

export type AgentLayer = "worker" | "governance" | "admin";
export type AgentNode = "local" | "cloud" | "mobile";
export type AgentRuntime = "local" | "cloud";
export type AgentStatus =
  | "idle"
  | "running"
  | "blocked"
  | "review"
  | "error"
  | "stopped";

export interface AgentModelParam {
  id: string;
  value: string | number | boolean;
}

export interface AgentModel {
  id: string;
  params?: AgentModelParam[];
}

export interface AgentMemoryUsage {
  tokens_in_context?: number;
  max_context?: number;
}

/**
 * CodeFlow Agent — defines a digital employee.
 * Direct 1:1 mirror of `schemas/agent.schema.json` v0.1.
 */
export interface Agent {
  $schema?: string;
  /** Globally unique role-level id (NOT the SDK agentId). Pattern: `^[A-Z][A-Z0-9_-]+(-\d+)?$`. */
  agent_id: string;
  /** Cursor SDK agentId returned from `Agent.create()`. Used by `Agent.resume()`. */
  sdk_agent_id?: string | null;
  /** Mapped to `roles.yaml` `roles[].id`. */
  role: string;
  /** 3-layer org structure (§0.9.1). */
  layer: AgentLayer;
  /** Which node the agent runs on. */
  node: AgentNode;
  /** Cursor SDK runtime mode. */
  runtime: AgentRuntime;
  /** For local agents: cwd path. For cloud agents: repo URL. */
  workspace?: string;
  model?: AgentModel;
  /** Active MCP skill IDs. MUST include `fcop` (kernel dependency). */
  skills: string[];
  status: AgentStatus;
  /** Currently held Task ID. `null` when idle. */
  current_task?: string | null;
  current_session?: string | null;
  memory_usage?: AgentMemoryUsage;
  started_at?: IsoDateTime;
  last_active_at?: IsoDateTime;
  /** User-defined tags (always-open extension point per §3.8). */
  labels?: Record<string, string>;
}

// ───────────────────────────────────────────────────────────────────────────
// §3.3 Task Schema  (mirror of schemas/task.schema.json)
// ───────────────────────────────────────────────────────────────────────────

export type TaskPriority = "P0" | "P1" | "P2" | "P3";

export type TaskStatus =
  | "pending"
  | "dispatched"
  | "in_progress"
  | "review"
  | "done"
  | "blocked"
  | "cancelled";

export interface TaskStateHistoryEntry {
  state: string;
  at: IsoDateTime;
  by: string;
}

/**
 * CodeFlow Task — backward-compatible with FCoP `TASK-*.md` front-matter.
 * Direct 1:1 mirror of `schemas/task.schema.json` v0.1.
 *
 * Note: schema sets `additionalProperties: true` (FCoP front-matter is open),
 * which is reflected here by allowing `[k: string]: unknown` fallback fields.
 */
export interface Task {
  $schema?: string;
  /** MUST be `"fcop"` — FCoP kernel marker. */
  protocol: "fcop";
  fcop_version?: string;
  runtime_protocol_version?: string;
  /** Globally unique. MUST match the filename (without .md). */
  task_id: string;
  sender: string;
  recipient: string;
  priority: TaskPriority;
  thread_key?: string | null;
  parent_task?: string | null;
  status: TaskStatus;
  /** Append-only audit trail. Never delete entries. */
  state_history?: TaskStateHistoryEntry[];
  review_required?: boolean;
  review_assignee?: string | null;
  /** `high`/`irreversible` auto-trigger HITL. See §0.9.4. */
  risk_level?: RiskLevel;
  created_at?: IsoDateTime;
  updated_at?: IsoDateTime;
  deadline?: IsoDateTime | null;
  labels?: Record<string, string>;
  /** FCoP front-matter is open-ended; consumers may carry extra fields. */
  [k: string]: unknown;
}

// ───────────────────────────────────────────────────────────────────────────
// §3.4 Review Schema  (mirror of schemas/review.schema.json)
// ───────────────────────────────────────────────────────────────────────────

export type ReviewSubjectType = "task" | "code_change" | "report" | "role_switch";

export type ReviewDecision =
  | "approved"
  | "rejected"
  | "needs_changes"
  | "abstained"
  | "needs_human";

/** Per-member decision inside a Review Board. */
export type ReviewBoardMemberDecision =
  | "approved"
  | "rejected"
  | "needs_changes"
  | "abstained";

export interface ReviewBoardMember {
  role: string;
  agent?: string | null;
  decision: ReviewBoardMemberDecision;
  decided_at?: IsoDateTime | null;
}

export interface ReviewBoard {
  policy?: string;
  members?: ReviewBoardMember[];
  consensus_required?: number;
  consensus_reached?: boolean;
}

/**
 * Human-in-the-loop approval block.
 * Required when `Review.decision === "needs_human"` (enforced by schema `allOf`).
 */
export interface HumanApproval {
  pushed_to: "mobile" | "cli";
  pushed_at: IsoDateTime;
  approved_by?: string | null;
  approved_at?: IsoDateTime | null;
  trigger_reason: string;
}

/**
 * CodeFlow Review — verdict on a subject. Lives in `REVIEW-*.md` front-matter.
 * Direct 1:1 mirror of `schemas/review.schema.json` v0.1.
 */
export interface Review {
  $schema?: string;
  protocol: "fcop";
  runtime_protocol_version?: string;
  /** Pattern: `^REVIEW-\d{8}-\d{3}-[A-Z]+-on-TASK-\d{8}-\d{3}.*$` */
  review_id: string;
  subject_type: ReviewSubjectType;
  /** ID of the object being reviewed. */
  subject_ref: string;
  reviewer_role?: string | null;
  reviewer_agent?: string | null;
  /** Multi-reviewer mode (v0.5+). See §0.9.5.B. */
  review_board?: ReviewBoard | null;
  decision: ReviewDecision;
  rationale?: string;
  required_changes?: string | string[] | null;
  /** Required when `decision === "needs_human"`. */
  human_approval?: HumanApproval | null;
  decided_at: IsoDateTime;
  decision_duration_ms?: number | null;
  /** Open-ended for reviewer-specific metadata. */
  [k: string]: unknown;
}

// ───────────────────────────────────────────────────────────────────────────
// §3.5 Session Schema  (mirror of schemas/session.schema.json)
// ───────────────────────────────────────────────────────────────────────────

export type SessionStatus = "running" | "completed" | "failed" | "cancelled";
export type RunStatus = "running" | "finished" | "failed" | "cancelled";

export interface SessionRunTokensUsed {
  input?: number;
  output?: number;
  thinking?: number;
}

export interface SessionRun {
  /** Pattern: `^run-[a-z0-9-]+$` */
  run_id: string;
  started_at: IsoDateTime;
  ended_at?: IsoDateTime | null;
  status: RunStatus;
  tokens_used?: SessionRunTokensUsed | null;
  tool_calls_count?: number;
  transcript_path?: string | null;
}

export interface SessionOutcome {
  files_changed?: string[];
  report_ref?: string | null;
  /** Open per schema (`additionalProperties: true`). */
  [k: string]: unknown;
}

/**
 * CodeFlow Session — an agent ↔ task conversation.
 * Direct 1:1 mirror of `schemas/session.schema.json` v0.1.
 */
export interface Session {
  $schema?: string;
  /** Pattern: `^session-[a-z0-9-]+$` */
  session_id: string;
  agent_id: string;
  task_id: string;
  started_at: IsoDateTime;
  ended_at?: IsoDateTime | null;
  status: SessionStatus;
  runs: SessionRun[];
  total_cost_usd?: number | null;
  outcome?: SessionOutcome | null;
}

// ───────────────────────────────────────────────────────────────────────────
// §3.6 Skill Schema  (mirror of schemas/skill.schema.json)
// ───────────────────────────────────────────────────────────────────────────

export type SkillTransport = "stdio" | "http" | "sse";

export interface SkillProvidedBy {
  type: "mcp_server";
  transport: SkillTransport;
  /** Required for `stdio` transport. */
  command?: string;
  /** Required for `http` / `sse` transport. */
  url?: string;
  [k: string]: unknown;
}

export interface SkillTool {
  name: string;
  required_perms?: string[];
  risk_level?: RiskLevel;
  irreversible?: boolean;
  cost_sensitive?: boolean;
}

/**
 * CodeFlow Skill — an MCP server registered as a skill.
 * Direct 1:1 mirror of `schemas/skill.schema.json` v0.1.
 */
export interface Skill {
  $schema?: string;
  /** Pattern: `^[a-z][a-z0-9_-]*$` */
  skill_id: string;
  /** Pattern: `^\d+\.\d+\.\d+(-.*)?$` */
  version: string;
  displayName?: string;
  provided_by: SkillProvidedBy;
  tools: SkillTool[];
  /** Which roles can mount this skill. */
  available_to_roles: string[];
  /**
   * Hard kernel deps. Skills exposing fcop-aware tools MUST list
   * `fcop@>=1.0` or `fcop@>=1.0-pre`.
   */
  required_kernel: string[];
  compatible_runtimes?: AgentRuntime[];
  homepage?: string;
  license?: string;
}
