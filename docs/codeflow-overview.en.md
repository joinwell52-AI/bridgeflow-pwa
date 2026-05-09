# CodeFlow AI Runtime / AI OS

> **Draft v0.1** (Public-facing executive overview · Authored by ADMIN-01, 2026-05-09)
>
> **What is this?**
> A 5-minute read for first-time visitors to understand CodeFlow's positioning, philosophy, architecture, and roadmap.
>
> ### 📜 Project Charter (ADMIN's two verbatim quotes, 5/9, locked)
>
> 1. ADMIN 5/9 10:48 — *"This project folder is the CodeFlow project; we currently use Cursor's SDK and consume `fcop-mcp`."* (identity + tech stack)
> 2. ADMIN 5/9 10:51 — *"CodeFlow's true positioning is: a lightweight AI Runtime / AI OS for multi-agent software development."* (true positioning)
>
> Original verbatim Chinese quotes + interpretation table: see [design doc §0.0](./design/codeflow-v2-on-fcop-sdk.md).
>
> **Official positioning (consistent with the design doc):**
>
> > **CodeFlow AI Runtime**
> > *A lightweight AI Operating Runtime for multi-agent software development.*
> > *Mobile-first AI Runtime for governable multi-agent software development.*
>
> 中文版：[`docs/codeflow-overview.md`](./codeflow-overview.md)

### This doc vs. the design doc — when to read which

| Who you are / what you want | Read which |
|---|---|
| 5 minutes to grok what CodeFlow is | **This file (overview)** |
| Pitching to non-technical readers / decision makers / investors | **This file (overview)** |
| Going to implement / write code / plan sprints | [Design doc](./design/codeflow-v2-on-fcop-sdk.md) (~1900 lines) |
| Looking for specific fields / schemas / APIs | Design doc §3 |
| Want to know what to do next week | Design doc §10 |
| Want to know why this design | Design doc §0.5 / §0.6 / §0.7 |

> **Sync rule when editing:**
>
> - Change "what we say externally, product positioning, narrative for non-technical readers" → edit **this file**
> - Change "implementation, field definitions, sprint plans, technical decisions" → edit the **design doc**
> - Concept appears in both → **the design doc is source of truth; this file is the simplified narrative**

---

## 1. Positioning

### What is CodeFlow?

CodeFlow is **NOT**:

- An AI chat tool
- A Cursor plugin
- An auto-codegen tool

CodeFlow's true positioning:

> A **lightweight AI Runtime / AI OS** for multi-agent collaborative software development.

### Core problem

Solving:

> **Multiple AI agents cannot collaborate stably over time.**

Including:

- Agent drift
- State loss
- Lack of auditability
- Long-task chaos
- No governance mechanism
- No state recovery

---

## 2. Core Philosophy

### 2.1 AI must "externalize state"

Traditional agents:

> State lives inside context.

Problems:

- Unstable
- Easily lost
- Not auditable

CodeFlow:

> AI state → file → protocol → governable

### 2.2 Protocol-driven

CodeFlow does **NOT depend on**:

- A single model
- A single IDE
- A single agent

Instead:

> Constrain agent behavior via the **FCoP protocol**.

### 2.3 AI needs governance

What enterprises actually need is not:

> A more autonomous AI.

But:

> **Auditable, recoverable, governable AI.**

---

## 3. System Architecture

```text
                ┌────────────────┐
                │ Mobile Console │
                └───────┬────────┘
                        ↓
                ┌────────────────┐
                │ CodeFlow Runtime│
                └───────┬────────┘
        ┌───────────────┼──────────────┐
        ↓               ↓              ↓
 ┌────────────┐ ┌────────────┐ ┌────────────┐
 │ Task Store │ │ Agent Core │ │ Review Sys │
 └────────────┘ └────────────┘ └────────────┘
                        ↓
                ┌────────────────┐
                │ Skill Runtime  │
                └───────┬────────┘
                        ↓
             ┌────────────────────┐
             │ Cursor / Claude SDK│
             └────────────────────┘
```

---

## 4. Core Modules

### 4.1 Runtime Core

Responsibilities:

- Manage Task lifecycle
- Manage Agent Sessions
- Schedule agents
- Control state transitions
- Recover from failures

#### Runtime state machine

```text
INIT
 ↓
PLANNED
 ↓
EXECUTING
 ↓
REVIEWING
 ↓
APPROVED / REJECTED
 ↓
DONE
```

> **External state names ↔ internal protocol state names** (implementation: design doc §3.3 Task Schema):
>
> | External (this doc) | Internal (FCoP / Task Schema) |
> |---|---|
> | INIT | (Task file not yet created) |
> | PLANNED | `pending` |
> | EXECUTING | `dispatched` → `in_progress` |
> | REVIEWING | `review` |
> | APPROVED → DONE | `done` |
> | REJECTED | back to `in_progress`, loop ≤ N times |
> | (anomaly) | `blocked` / `cancelled` |

### 4.2 Task System

> **Single hard rule: every task MUST be filed.**
> If it isn't written down, it didn't happen.

CodeFlow's Task format evolves in two stages:

#### Today (v0.1, fully FCoP-compatible)

Each Task is a single Markdown file, named by "sender → recipient":

```text
docs/agents/tasks/
├── TASK-20260509-001-PM-to-DEV.md       ← Task body
├── REPORT-20260509-001-DEV-to-PM.md     ← Execution report
└── REVIEW-20260509-001-QA-on-TASK-001.md ← Review verdict
```

This "filename = protocol" is the core of FCoP, and v0.1 must be 100% compatible with it. Details: design doc §3.3.

#### Future (v0.x+, Task-as-folder)

As tasks grow (one Task may produce plan / execution / result artifacts), it will evolve to a directory structure:

```text
tasks/
 └── TASK-001/
      ├── task.md         # Goal + Constraints
      ├── plan.md         # PM breakdown
      ├── execution.md    # DEV implementation log
      ├── result.md       # Final artifact index
      └── review.md       # Review verdict
```

> ⚠️ **v0.1 does NOT enforce directory format** — the evolution path stays backward-compatible: file-based and folder-based Tasks can coexist as long as YAML front-matter stays consistent.
>
> Note: FCoP itself is still pre-1.0, so directory format may be promoted into the FCoP main spec in 1.1 / 2.0. Details: design doc §3.3.1.

#### `task.md` example

```markdown
# Goal
Implement user login.

# Constraints
- Use JWT
- Do not modify the database schema
```

#### `review.md` example

```markdown
# Review

## Security
✅ No dangerous operations.

## Architecture
⚠️ Need to add token expiration mechanism.
```

### 4.3 Agent Runtime

CodeFlow does **NOT pursue**:

> A super-agent that does everything.

Instead:

> **Specialized role agents.**

#### Examples

- PM Agent
- DEV Agent
- REVIEW Agent
- TEST Agent
- ARCHITECT Agent

#### Agent Schema

```json
{
  "agent_id": "DEV-01",
  "role": "developer",
  "status": "running",
  "task_id": "TASK-001"
}
```

### 4.4 Review Engine (core)

One of CodeFlow's core systems:

> **AI must be audited.**

#### Phase 1

Rule-based audit:

```text
Forbidden:
- DELETE
- DROP
- rm -rf
```

#### Phase 2

AI-based review:

- Does it match the task goal?
- Are there risks?
- Has the agent drifted?

### 4.5 Session Runtime

Future support:

- Cursor
- Claude Code
- Codex
- VSCode Agent

A Session is no longer:

> A chat window.

But:

> **A long-running agent process.**

---

## 5. Mobile (Mobile Governance)

One of CodeFlow's biggest differentiators:

> **The AI Runtime is governable from a phone.**

The mobile end is **NOT** a chat box. It is:

> **An AI Team Console.**

### Mobile features

#### Task view

```text
TASK-001
Status: Reviewing
Owner: DEV-01
```

#### Agent status

```text
DEV-01: running
REVIEW-01: auditing
```

#### Admin approval

```text
⚠️ High-risk operation:
Allow execution?
```

#### Emergency Stop

```text
🛑 Stop all agents
```

---

## 6. Why FCoP

FCoP is **NOT a prompt**.

It is:

> **An AI Runtime Protocol.**

### What FCoP provides

- Task protocol
- State protocol
- Review protocol
- Agent protocol
- Collaboration protocol

### Goal

Enable:

> **Stable cross-agent collaboration.**

---

## 7. Roadmap

> This is the **public-facing high-level roadmap** (5 milestones). The detailed sprint plan (v0.1 → v1.0, ~26 weeks) is in design doc [§10 Implementation Roadmap](./design/codeflow-v2-on-fcop-sdk.md#10-实施路线图roadmap--sprint-plan).

### v0.1 — Backend Kernel (~6 weeks)

Goal:

> **Local zero-UI run-through: PM → DEV → REVIEW → DONE filed loop.**

Includes:

- Task Runtime
- Review Engine (core)
- Session persistence
- Auto-recovery after process crash

Excluded: mobile / cloud / skill marketplace / enterprise permissions / any GUI.

[Design doc §10.2](./design/codeflow-v2-on-fcop-sdk.md#102-v01-backend-kernel6-sprint每-sprint-1-周)

### v0.2 — Mobile Governance (~4 weeks)

Goal:

> **AI runs 24/7; ADMIN can approve and emergency-stop from the couch.**

Includes:

- Mobile Console (4 screens: Task Flow / Agent status / Audit / Approval)
- Human-in-the-loop (high-risk ops require mobile approval)
- 🛑 Emergency Stop

Excluded: cloud nodes (deferred to v0.3+) / writing tasks from mobile / multi-device sync.

[Design doc §10.3](./design/codeflow-v2-on-fcop-sdk.md#103-v02-mobile-governance-mvp4-sprint)

### v0.3 / v0.5 — Governance depth

| Version | Theme | Key capability |
|---|---|---|
| **v0.3** | AI Patrol | PATROL agent monitors 5 anomaly classes (drift / hang / over-permission / unresponsive / protocol violation) |
| **v0.5** | Review Board | REVIEW + SECURITY + AUDIT triangle consensus; single reviewer cannot approve high-risk tasks alone |

[Design doc §10.4 / §10.5](./design/codeflow-v2-on-fcop-sdk.md#104-v03-ai-patrol3-sprint)

### v1.0 — Schema Freeze + first external users (~9-week window)

Goal:

> **Freeze the Runtime Protocol (5 schemas) so the ecosystem can grow on top.**

Acceptance criteria (3 of 4): ≥3 third-party implementations / 90 days no breaking change / ≥1 essay summarizing protocol evolution / pass schema fuzz tests.

[Design doc §10.6](./design/codeflow-v2-on-fcop-sdk.md#106-v10-schema-freeze--第一批外部用户9-周窗口)

### Long-term

Continue evolving toward:

> **AI Operating System** — see §8 Long-term Vision.

---

## 8. Long-term Vision

Future enterprise workflow:

```text
Human
  ↓
CodeFlow Runtime
  ↓
Multiple AI Agents
  ↓
Business Systems / IDE / Cloud
```

Instead of:

```text
Human → ERP → Manual Operation
```

### Why the AI OS may be the "next-generation ERP"

ERP's essence is *"let a group of humans collaborate stably around business processes."*
The AI OS's essence is *"let a group of AI agents collaborate stably around business processes."*

| Dimension | Traditional ERP | AI OS (CodeFlow's endgame) |
|---|---|---|
| Collaboration agents | Humans + processes + forms | AI agents + protocols + Task files |
| State medium | Database + ticket system | FCoP files + Runtime state |
| Governance | Approval flows / permission matrix | Review Engine + Human-in-the-loop |
| Human intervention | Most operations | High-risk decision points (mobile approval) |
| Observability | BI reports | Runtime event stream + audit log |

It's not that AI OS will "replace" ERP — the realistic evolution is: **AI OS dilutes the "humans-execute-process" portion of ERP**, and ERP degrades into one of the business systems that AI agents call into.

Details: design doc [§0.6.6 Endgame: AI OS may be the next-generation ERP](./design/codeflow-v2-on-fcop-sdk.md).

---

## 9. Core Idea Summary

> AI's problem has never been "not smart enough."
>
> It is:
>
> **"Cannot collaborate and run stably over time."**

CodeFlow's goal:

> Provide AI teams with **Runtime, Protocol, and Governance**.

---

## Want to dive deeper? Jump by role

| What you want to know | Jump to design doc |
|---|---|
| 1-screen exec summary | [§0.0 Executive Summary](./design/codeflow-v2-on-fcop-sdk.md#00-executive-summary1-屏读完) |
| Why this design (AI OS prototype / 3-layer stack / moat) | §0.5 / §0.6 / §0.7 |
| What's in/out of scope for phase 1 | §0.8 First-phase scoping |
| How mobile governance works (4 screens / HITL / Emergency Stop) | §0.9 Mobile-first Governance |
| 5 Runtime Schemas (Agent/Task/Review/Session/Skill) | §3 Runtime Protocol |
| Sprint-level plan | §10 Implementation Roadmap |
| Want to run a demo | §0.8.3 Hello World acceptance script |

---

## Doc tree

```text
docs/
├── codeflow-overview.md            ← Chinese
├── codeflow-overview.en.md         ← English (you are here)
└── design/
    └── codeflow-v2-on-fcop-sdk.md  ← Full design doc (~1900 lines, ~60 min)
```

---

## 5-minute self-check (did you really get it?)

After reading this page, you should be able to answer the following 5 questions without looking. If any one stumps you, re-read the section it points to.

| # | Question | Section |
|---|---|---|
| 1 | What is CodeFlow **NOT**? Why insist "not a Cursor plugin"? | §1 |
| 2 | What does "AI state externalization" mean? What goes wrong without it? | §2.1 |
| 3 | Why is the Review Engine called a "core system"? What's the difference from generic agent frameworks without it? | §4.4 |
| 4 | Why is mobile not a chat box but an "AI Team Console"? | §5 |
| 5 | What is v0.1's *single* goal? Can you start v0.2 if v0.1 hasn't passed? | §7 v0.1 |

**Bonus questions** (if you can answer these, you're at the decision-maker level):

- 6. Why is CodeFlow's true moat *Agent Governability*, not UI / prompt / model? → Design doc §0.6.7
- 7. Why is v2's core deliverable the 5 Schemas, not an "application"? → Design doc §3 + §0.6.8 (Docker eve analogy)

---

> **Heads-up before you go:**
>
> After every major edit to this page, please **re-check §0.0 Executive Summary** in the design doc.
> These two files together form CodeFlow v2's "public face." Any change to core concepts (positioning / moat / roadmap cadence / mobile shape) requires updating both sides.
