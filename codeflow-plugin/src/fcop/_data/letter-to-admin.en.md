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
| `qa-team` | QA testing | `LEAD-QA` · `TESTER` · `AUTO-TESTER` · `PERF-TESTER` | `LEAD-QA` |

Tool call: `init_project(team="dev-team", lang="en")`

**Presets come with role responsibility docs** (new in 0.5.0): each
preset ships a bilingual `.md` file per role. Init drops them into
`docs/agents/shared/roles/` so an agent who's just been assigned a
role can read its own job description inside the repo instead of
waiting for you to spell it out.

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

**Custom teams don't ship role docs — but samples are one click away**:
after creating a custom team, FCoP tells your agent
*"See `fcop://teams/<team>` for reference samples"*
(dev-team / media-team / mvp-team / qa-team each bundles a full
bilingual role split). The agent naturally studies those before
drafting your own `shared/TEAM-ROLES.md` and
`shared/TEAM-OPERATING-RULES.md`. You can seed it with one sentence:
**"Mirror media-team's chain of command."**

---

## Hard rules for custom roles

Role codes go straight into filenames
(`TASK-20260417-001-MANAGER-to-CODER.md`), so the rules come from the
filename grammar:

| Item | Rule | OK ✅ | Not OK ❌ |
|---|---|---|---|
| Role code | Starts with uppercase letter; `A-Z` `0-9` `_` `-`; `-` not at start / end / consecutive | `MANAGER` `QA1` `CODER_A` `LEAD-QA` `AUTO-TESTER` | `程序员` `-QA` `PM--QA` `QA.1` `my boss` |
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
├── docs/agents/             ← Coordination metadata (who does what)
│   ├── fcop.json            ← Project identity (mode / roles / leader)
│   ├── tasks/               ← Tasks in flight
│   ├── reports/             ← Completion reports
│   ├── issues/              ← Issue records
│   ├── shared/              ← Standing docs (dashboards, glossaries …)
│   ├── log/                 ← Archives
│   └── LETTER-TO-ADMIN.md   ← This letter, kept for reference
├── workspace/               ← ★ Artifact home (code, scripts, data) ★
│   └── README.md            ← Convention reference
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

## Where artifacts go: the `workspace/<slug>/` convention

This is the question nobody sees coming on day one and everybody
regrets on day two:

**You ask the agent to build a CSDN search tool; it dumps `app.py`,
`pyproject.toml`, and `*.bat` straight into the project root. Day two
you ask for a small game, `pyproject.toml` collides, `app.py` gets
overwritten, and the `*.bat` files are mixed together with no way to
tell which is which.**

FCoP 0.4.7 bakes the answer into init: **the project root only holds
coordination metadata; actual work products go under
`workspace/<slug>/`. One slug per "thing you're doing", fully
isolated.**

```
codeflow-3/
├── .cursor/ docs/ fcop.json LETTER-TO-ADMIN.md   ← coordination skeleton, never mixed
└── workspace/
    ├── csdn-search/         ← today: CSDN article search
    │   ├── app.py
    │   ├── templates/
    │   ├── *.bat
    │   └── pyproject.toml
    └── mini-game/           ← tomorrow: small game (own cage, fully isolated)
        ├── game.py
        └── assets/
```

### How to open a new cage

Both are fine:

1. **Ask the agent to call** (recommended):

    ```
    new_workspace(slug="csdn-search", title="CSDN Article Search Tool")
    ```

    FCoP creates the directory, writes a minimal README, and drops a
    `.workspace.json` metadata file.

2. **Just `mkdir` it yourself**: make a folder under `workspace/`
    by hand. The agent still recognizes it, and `list_workspaces()`
    still lists it.

### Slug naming rules (FCoP validates automatically)

| ✅ Legal | ❌ Illegal | Why |
|---|---|---|
| `csdn-search` | `CSDN-Search` | lowercase required |
| `mini-game` | `mini_game` | only `-` as separator (inverse of role codes) |
| `weekly-report-2026w17` | `周报` | no non-ASCII |
| `api-v2` | `my game` | no spaces |
| `search` | `tmp` / `shared` / `archive` | reserved |

Same as role codes: mistypes get a friendly "Suggested fix: `xxx`"
reply. Max 40 characters.

### One-shot overview

To see how many cages the project has and what they're for, have the
agent call:

```
list_workspaces()
```

Output shows each slug's title and creation time.
`get_team_status()` also includes the workspace count.

### Hard rules

- ❌ The agent **must not write business code into the project root**
  (`app.py` / `pyproject.toml` etc.)
- ❌ Files are not shared across slugs
- ✅ If you need something shared across cages, open
  `workspace/shared/` — FCoP reserves that slug for exactly this

---

## How you actually use FCoP: just talk

**First, the important part**: FCoP ships 19 tools — **all of them are
for the agent, not for you**. You talk in plain language from start to
finish; the agent translates your intent into the right tool call.

```
You (ADMIN)         Agent (AI)            FCoP toolbox
  speak     ────→   understand   ────→    call the tool
                                              ↓
                                       write files / make dirs / check state
```

You do not have to memorize any tool names. The table below is a
"**when you say X, the agent does Y**" reference — so that *if* the
agent forgets what to do, you can spot it and nudge it back.

### Project kickoff

| You say | Agent calls | Outcome |
|---|---|---|
| (first sentence of a new session) | `unbound_report()` | Agent reports project state; tells you if it's uninitialized or unassigned |
| "initialize a Solo project" / "I'll do it myself" | `init_solo(role_code="ME")` | Writes `fcop.json`, creates directories, deploys rules + letter, creates `workspace/` |
| "initialize a dev team" / "I want a 4-role team" | `init_project("dev-team")` or `create_custom_team(...)` | Same as above, multi-role |
| "MCP is bound to the wrong dir" / `unbound_report` shows `C:\Users\xxx` | `set_project_dir("E:\\your-project")` | Rebinds at runtime; no config edits, no restart |
| "you are PM" / "you are ME" | (no tool call; the agent just remembers its role) | Enters Phase 3 and starts working |

### Day-to-day work

| You say | Agent calls | Outcome |
|---|---|---|
| "build a CSDN search tool" / "start a new thing for X" | `new_workspace(slug="csdn-search", title="...")` | Creates `workspace/csdn-search/` cage; all artifacts land inside |
| "assign a task to CODER" / "ask X to do Y" | `write_task(recipient="CODER", body="...")` | Drops a `TASK-*-to-CODER.md` |
| "what's the state of the project" | `get_team_status()` | Task / report / issue / workspace counts + recent activity |
| "how many workspaces do we have?" | `list_workspaces()` | Lists every `workspace/<slug>/` with create time |
| "what tasks are still pending?" | `list_tasks()` | Lists unarchived `tasks/` |
| "what does task X say?" | `read_task("TASK-...")` | Reads body |
| "any open issues?" | `list_issues()` | Lists `issues/` |
| "archive X, it's done" | `archive_task("TASK-...")` | Moves to `log/` |
| "show me the completion reports" | `list_reports()` / `read_report(...)` | Reads `reports/` |

### Rescue / edge cases

| You say | Agent calls | Outcome |
|---|---|---|
| "I don't like this FCoP rule" | `drop_suggestion("...", "...")` | Feedback lands under `.fcop/proposals/` (you can't edit the rules files yourself) |
| "validate this team config before creating it" | `validate_team_config("MANAGER,CODER", "MANAGER")` | Dry-run check, returns suggestions on error |
| "what team presets exist?" | `get_available_teams()` | Lists Solo / dev-team / media-team / mvp-team |
| "let me re-read the manual" | Reads `fcop://letter/en` or opens `docs/agents/LETTER-TO-ADMIN.md` | Re-renders this letter |

### The only 2 tool names you might actually type

- **`unbound_report`** — if a new session's agent doesn't auto-report,
  just say "report first" or literally "call `unbound_report`".
- **`set_project_dir`** — when you see the MCP bound to the wrong
  directory (e.g. `unbound_report` shows a `C:\Users\xxx` path), say
  "bind to `E:\your-project`" or literally "call `set_project_dir("...")`".

**The other 17 are never yours to memorize**. The agent picks.

### Why the agent knows what to call

Because FCoP tells it in three places **at once**:

1. **MCP instructions** (always read on agent startup) — includes the
   "when ADMIN says X, call Y" map baked in.
2. **Each tool's docstring** (visible to the agent) — describes exactly
   when to invoke it.
3. **`fcop-rules.mdc`** (`alwaysApply: true`) — enforces hard rules
   like Rule 0.

So your job is just plain language. If the agent misses something
obvious (e.g. doesn't open a workspace when it should, or skips
`unbound_report`), point it at the relevant row of this letter — the
correction takes one line.

### 6 resources (agent-only; you never touch these)

| URI | Who reads it | What it is |
|---|---|---|
| `fcop://rules` | Agent | `fcop-rules.mdc` raw |
| `fcop://protocol` | Agent | `fcop-protocol.mdc` raw |
| `fcop://letter/zh` or `/en` | Agent when it wants to re-read | This letter |
| `fcop://status` | Agent | Same as `get_team_status` |
| `fcop://config` | Agent | `fcop.json` raw |

### ⚠️ Cursor's "click-to-grey-out" switches: 2 you must never grey

Cursor's MCP panel shows these 19 tools as buttons. Click → greyed =
disabled. **Greying these two will hurt you**:

- `unbound_report` — greyed out, Rule 0 breaks; agents can't take
  their mandatory first step
- `set_project_dir` — greyed out, your only rescue for a
  wrong-directory binding is editing `mcp.json` + restarting Cursor

The other 17 can technically be greyed out, but the agent just gets
confused when a tool suddenly disappears — **keep them all enabled**.

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
