# A Letter from FCoP to ADMIN — User Manual

Hi ADMIN.

I'm **FCoP** (File-based Coordination Protocol) — a protocol that lets
you and an AI team collaborate through **files**. Your one job:
**tell me how many people this project has and how they split the work.**

---

## Identities up front

```
   Human                          AI team
┌─────────┐                   ┌──────────────────────┐
│  ADMIN  │◄──── TASK-*.md ──►│  leader              │
│  (you)  │                   │    │                 │
└─────────┘                   │    ├──► AI role 2    │
                              │    ├──► AI role 3    │
                              │    └──► AI role 4    │
                              └──────────────────────┘
```

| Who | What | Note |
|---|---|---|
| **Human** | You | Role code is always `ADMIN`, exactly one instance |
| **AI team** | N agents | N "job positions" named by you (`PM` / `MANAGER` / `ME` …) |

- `ADMIN` **is NOT written into `fcop.json.roles`** — it's FCoP's
  reserved role.
- Your instructions go to the **leader** only; the leader decides what
  to dispatch to other AI roles (Rule 4).
- Even in Solo mode, the single AI role is not you — it's your AI
  assistant.

---

## Three ways to start (ordered by frequency)

### A. Just you (Solo, most common)

Say this to your Agent:

> **"Initialize the project in Solo mode, role code `ME`."**

Tool call:

```
init_solo(role_code="ME", role_label="Me", lang="en")
```

Solo = one agent wearing many hats. You (`ADMIN`) talk to the AI (`ME`)
directly — no multi-level dispatch. But **Rule 0.b still applies**: the
agent first writes a proposal file → does the work → re-reads its own
proposal as a reviewer, using files to split "proposer" from "reviewer".

### B. Use a preset 4-role team

> **"Initialize the project with the `dev-team` preset."**

| Template | For | AI roles | leader |
|---|---|---|---|
| `dev-team` | Software dev | `PM` · `DEV` · `QA` · `OPS` | `PM` |
| `media-team` | Content | `PUBLISHER` · `COLLECTOR` · `WRITER` · `EDITOR` | `PUBLISHER` |
| `mvp-team` | Startup MVP | `MARKETER` · `RESEARCHER` · `DESIGNER` · `BUILDER` | `MARKETER` |

Tool call: `init_project(team="dev-team", lang="en")`

### C. Build your own team

**Canonical phrasing:**

> **"Build an AI team with 4 roles: `MANAGER` as leader, plus `CODER`,
> `TESTER`, `ARTIST`. Team name 'My Design Studio', English UI."**

Tool call:

```
create_custom_team(
  team_name="My Design Studio",
  roles="MANAGER,CODER,TESTER,ARTIST",
  leader="MANAGER",
  lang="en"
)
```

---

## Hard rules for custom roles

Role codes go straight into filenames
(`TASK-20260417-001-MANAGER-to-CODER.md`), so the rules come from the
filename grammar:

| Item | Rule | OK ✅ | Not OK ❌ |
|---|---|---|---|
| Role code | Starts with uppercase letter, only `A-Z` `0-9` `_` | `MANAGER` `QA1` `CODER_A` | `程序员` `DEV-TEAM` `QA.1` `my boss` |
| Role count | ≥ 2 (single role ⇒ use Solo instead) | `MANAGER,CODER` | Only `MANAGER` |
| Leader | Must be in the role list | leader=`MANAGER` | leader=`CEO` (not in list) |
| Reserved | `ADMIN` and `SYSTEM` cannot be used as role codes | `MANAGER` | `ADMIN` `SYSTEM` |
| Team name | Anything; only used for display | "My Design Studio" | — |
| Language | `zh` or `en` | `en` | `English` |

**Naming hints** (to avoid semantic conflicts):

- ✅ Use **job-function words**: `MANAGER` / `CODER` / `WRITER` /
  `EDITOR` / `PM` / `DEV` / `QA`
- ✅ Use **uppercase Pinyin** if a Chinese word fits best:
  `JINGLI` / `CHENGXU` / `CESHI`
- ❌ Avoid **authority words**: `BOSS` / `CHIEF` / `MASTER` / `OWNER` /
  `CEO` / `KING` — the real "boss" is you (`ADMIN`); an AI role
  shouldn't wear that hat.
- ❌ **No non-ASCII**: the filename grammar is strictly ASCII.

## Proactive validation: you talk casually, FCoP stops the bad ones

**You don't need to memorize the rules above.** Every case below is
**stopped before anything hits disk**, with a bilingual concrete
explanation — not "success/failure", but **which field, which character,
and how to fix it**.

| You casually say | Agent tries | FCoP blocks, reason |
|---|---|---|
| "4-role team: `BOSS` `程序员` `测试` `设计师`" | `create_custom_team(roles="BOSS,程序员,...")` | ❌ Role code `'程序员'` illegal: non-ASCII not allowed |
| "Call them `DEV-TEAM` and `QA-1`" | `create_custom_team(roles="DEV-TEAM,QA-1,...")` | ❌ Role code `'DEV-TEAM'` illegal: `-` not allowed (collides with filename separators) |
| "Call it `my boss`" | `create_custom_team(roles="my boss,...")` | ❌ Role code `'my boss'` illegal: no spaces, must start uppercase |
| "Call it `QA.1`" | `create_custom_team(roles="QA.1,...")` | ❌ Role code `'QA.1'` illegal: `.` not allowed |
| "Add `ADMIN` to the team" | `create_custom_team(roles="ADMIN,CODER,...")` | ❌ `'ADMIN'` is FCoP-reserved (the human's identity); cannot be given to an AI |
| "Single role: `MANAGER`" | `create_custom_team(roles="MANAGER", ...)` | ❌ At least 2 roles required; for a single-role setup use `init_solo(...)` |
| "Leader is `CEO`, roles are `MANAGER, CODER`" | `create_custom_team(roles="MANAGER,CODER", leader="CEO")` | ❌ `leader 'CEO'` must be one of the declared roles (current: `MANAGER, CODER`) |
| "`CODER`, `CODER`, `QA`" | `create_custom_team(roles="CODER,CODER,QA", ...)` | ❌ Role code `'CODER'` duplicated |

> **Since 0.4.6, errors walk you through the fix**: say `DEV-TEAM` and
> FCoP replies `Suggested fix: DEV_TEAM (casing / separators
> auto-repaired)`. Say `my boss` → `Suggested fix: MY_BOSS`. Typo the
> leader's casing → `Did you mean 'MANAGER'?` (did-you-mean).
> Suggestions are **hints only** — you always pick the final name.

**9 validation checks total**, all baked into `create_custom_team` /
`init_solo` — you don't call them, they just run:

1. Role code non-empty
2. Must match `^[A-Z][A-Z0-9_]*$` (uppercase start, only `A-Z` / `0-9` / `_`)
3. No non-ASCII, `-`, `.`, or spaces
4. Cannot be `ADMIN` (reserved for the human)
5. Cannot be `SYSTEM` (reserved for FCoP internals)
6. Non-solo teams: at least 2 roles (single-role → use `init_solo`)
7. No duplicates in the roles list
8. `leader` must be in the roles list
9. Every failure returns a **human-readable bilingual error**, not a boolean

**Want a dry-run before committing?** Have the agent call:

```
validate_team_config(roles="MANAGER,CODER,TESTER,ARTIST", leader="MANAGER")
```

Writes nothing; returns `OK` if valid, otherwise tells you exactly
what's wrong. Useful when you dictate a pile of role names and aren't
sure whether any of them contain illegal characters.

**Bottom line: you don't memorize rules.** Just tell the agent in plain
language what team you want. `create_custom_team` runs these 9 checks
automatically; if it fails, the agent will come back to you with the
concrete reason.

---

## What lands on disk after init

```
project root/
├── docs/agents/
│   ├── fcop.json            ← Project identity (mode / roles / leader)
│   ├── tasks/               ← Tasks in flight
│   ├── reports/             ← Completion reports
│   ├── issues/              ← Issue records
│   ├── shared/              ← Standing docs (dashboards, glossaries …)
│   ├── log/                 ← Archives
│   └── LETTER-TO-ADMIN.md   ← This letter, kept for reference
└── .cursor/rules/
    ├── fcop-rules.mdc       ← Protocol rules (auto-injected per agent)
    └── fcop-protocol.mdc    ← Protocol commentary
```

Every message you send from now on becomes a file:

```
TASK-20260417-001-ADMIN-to-MANAGER.md    ← your instruction
TASK-20260417-001-MANAGER-to-ADMIN.md    ← MANAGER's report
```

**That's the whole of FCoP.**

---

## MCP capabilities at a glance (read this)

Once `fcop` MCP is installed, your agent can call **17 tools** and read
**6 resources**. The table below sorts them into three tiers —
required / optional / rescue. You don't have to memorize them; just know
what's there.

### 🔴 Mandatory flow (every project, day one)

| Tool | When to call | Required? | What it does |
|---|---|---|---|
| `unbound_report()` | **First action of every new session** | **Yes** | Rule 0 mandate. Uninitialized project → returns Phase 1 initialization report. Initialized but no role → returns Phase 2 UNBOUND report. |
| `init_solo()` OR `init_project()` OR `create_custom_team()` | **First time** the project is opened | **Pick one, required** | Writes `fcop.json`, creates directories, deploys rules + this letter. Skip this and FCoP is not really active. |
| `set_project_dir("E:\\your-project")` | When MCP is bound to the wrong dir (e.g. `unbound_report` shows `project: C:\Users\xxx`) | **Required in rescue** | Rebinds project root at runtime. No mcp.json edit, no Cursor restart. |

### 🟡 Optional daily tools

**Work tools** (only after you've assigned a role):

| Tool | Purpose | Typical use |
|---|---|---|
| `list_tasks()` | List unarchived tasks with frontmatter | Handover / catch-up |
| `read_task(path)` | Read task body | First step after assignment |
| `write_task(...)` | Write a new task (filename + frontmatter validated) | Dispatch / reply |
| `inspect_task(path)` | Read frontmatter only (callable while UNBOUND) | Patrol / audit |
| `list_reports()` / `read_report(path)` | List / read completion reports | Retro, handover |
| `list_issues()` | List issue files | Triage |
| `archive_task(path)` | Move finished task to `log/` | Periodic cleanup |

**Read-only status** (callable while UNBOUND):

| Tool | Purpose |
|---|---|
| `get_team_status()` | Task / report / issue counts + recent activity |
| `get_available_teams()` | All preset templates (Solo / dev / media / mvp) |
| `validate_team_config(roles, leader)` | **Dry-run** role-code validation before `create_custom_team` |

**Protocol feedback** (only when you disagree with FCoP itself):

| Tool | Purpose |
|---|---|
| `drop_suggestion(title, body)` | Lands feedback under `.fcop/proposals/` without polluting `docs/agents/` |

### 🟢 Resources (agent reads passively — you don't call these)

| Resource URI | Content | When it matters |
|---|---|---|
| `fcop://rules` | `fcop-rules.mdc` raw (the 9 protocol rules) | Agent needs a rules refresher |
| `fcop://protocol` | `fcop-protocol.mdc` raw (commentary) | Naming / YAML / directory specifics |
| `fcop://letter/zh` or `/en` | This letter itself | Re-read the manual |
| `fcop://status` | Project state (same as `get_team_status`) | Low-frequency |
| `fcop://config` | `fcop.json` raw | Low-frequency |

### ⚠️ The "click-to-grey-out" switches in Cursor's MCP panel

Cursor's MCP settings panel shows every tool as a clickable button.
**Click → greyed = disabled; click again → white = enabled.** This is a
Cursor feature, not an FCoP feature.

- ✅ Safe to grey out: optional tools you don't need (e.g. a chat-only
  project can grey out `archive_task` / `list_issues` to reduce noise)
- ❌ **Never grey out these two**:
  - `unbound_report` — greying it out breaks Rule 0; new sessions can't
    even take their mandatory first action
  - `set_project_dir` — greying it out leaves `mcp.json` edit + Cursor
    restart as your only rescue path when the MCP binds to the wrong
    directory

---

## Four must-read rules (cheat sheet)

| # | Rule | One line |
|---|---|---|
| 0.a | Land it as a file | Unfiled chat = never happened |
| 0.b | Multi-role checks | No single AI does decision-to-execution alone |
| **0.c** | **Only land true things** | **No fabrication; every reference cited** |
| 1 | UNBOUND | New sessions call `unbound_report()` first and wait for you |

Full 9-rule set: `.cursor/rules/fcop-rules.mdc` (agents read it
automatically). Commentary (naming, YAML, layout, patrol, citation
formats for 0.c, …): `.cursor/rules/fcop-protocol.mdc`.

---

## When you disagree

- Want the full rules → have the agent read `fcop://rules` or
  `fcop://protocol`
- Disagree with the protocol itself → have the agent call
  `drop_suggestion("...", "...")`; feedback lands under
  `.fcop/proposals/` without polluting the collaboration directory
- Want to switch templates → one line: "re-initialize with `{team}`"
- Want to re-read this letter → `fcop://letter/en` or
  `docs/agents/LETTER-TO-ADMIN.md`

Welcome aboard.

— **FCoP**
