---
protocol: fcop
version: 1
kind: draft
draft_id: DRAFT-20260511-001
sender: PM
recipient: ADMIN
priority: P1
thread_key: codeflow-fcop-issue-2-reply-v2-charter-6
references:
  - DRAFT-20260509-001-PM-to-ADMIN-issue-2-reply
  - https://github.com/joinwell52-AI/FCoP/issues/2
  - docs/internal/emergence-log.md
supersedes:
  - DRAFT-20260509-001
layer: governance
---

# DRAFT v2: issue #2 第三条 comment 草稿（**Charter 6 视角重写**）

> **状态**：PM 重写 v2。等 ADMIN 审改后，由 ADMIN 用 `@joinwell52-AI` 身份 post。
>
> **为什么需要 v2**（DRAFT-20260509-001 已过时）：
> 1. **fcop@1.1.0 已实际发布**（5/9-5/10 上 PyPI，提前 7-11 天）— 5 个 ADRs 全部 ship，Agent.layer / Task.risk_level / Review.decision=needs_human / Review.human_approval / Skill.tools risk_level 都已生效
> 2. **CodeFlow 战略升级 Charter 5 + 6**（ADMIN 5/11 09:35 + 14:21 双战略指令）— 从「FCoP reference impl」→「first-party app on FCoP AI OS」
> 3. **PM 第 4 次错误自披露**（5/11 上午）：原 DRAFT-001 §Q3 越位为 fcop 设计「NeedsHumanGate 是否能被 Boundary 替换」hypothesis — 违反 Charter 5 「不主动设计协议需求」+ 自约束 7。**必须撤回**
> 4. **CodeFlow v0.2 路径变化**：原 DRAFT-001 承诺「mirror 7-schema verbatim」— 现 P4 sprint 实际是**直接 import fcop Python 库** + pythonia 桥接，**不再持有自有 protocol package 的 schema 镜像**

---

## ✏️ 草稿正文 v2（建议直接 post 内容）

```markdown
## CodeFlow v0.3.0-alpha — first-party app on FCoP AI OS

Replying late but with stronger signal: **fcop@1.1.0 shipping early
(5/9-5/10 on PyPI, ~7-11 days ahead of the planned 5/16-5/20 window)
was the catalyst for the CodeFlow side to fundamentally reposition.**

### Short answer

- **Q1 (Boundary generalisation)**: yes, Boundary is the right
  abstraction. CodeFlow will use it as-shipped in fcop@1.1.0; we have
  no proposed extensions.
- **Q2 (`>=1.0,<2.0` pin)**: no longer applicable in the original
  shape — CodeFlow v0.3.0-alpha installs `fcop` as a Python runtime
  dependency through `pythonia` (`pip install "fcop>=1.1.0,<2.0.0"`)
  rather than as a TypeScript peer. Same versioning intent, different
  mechanism. Details below.
- **Q3 (field evidence for v1.2)**: **withdrawing the previous offer
  in the upstream draft.** Reason: the CodeFlow side has since adopted
  an internal rule ("do not author protocol-design hypotheses
  upstream — emergence first, escalate only after ≥3 confirmed
  blocked cases internally"). We'll surface evidence only when we
  actually hit it during v0.3.0-alpha operation, not speculatively.

### What changed on the CodeFlow side since the 5/9 reply

Two strategic clarifications from the CodeFlow human ADMIN that we
are happy to share publicly:

**1.** *"CodeFlow must be based on the FCoP protocol; it is just the
specific application of the protocol. No self-invention. If new needs
emerge, raise them with FCoP, and FCoP solves them."* (2026-05-11
09:35 UTC+8)

**2.** *"Given FCoP's future as the AI OS, CodeFlow can only build on
top of the FCoP protocol; any genuinely emergent need may supplement
FCoP, but emergence comes first."* (2026-05-11 09:37 UTC+8)

The implication for this issue: the CodeFlow side withdraws any
posture of co-designing fcop@1.x. We are a consumer, not a co-author.

### What this means concretely for CodeFlow v0.3.0-alpha

- `packages/codeflow-protocol/` — the TypeScript schema mirror — is
  being **deleted**, not "rewritten to match 7 schemas." CodeFlow no
  longer holds its own copy of the protocol shape.
- All Task / Review / Project / Boundary / Skill manipulation is now
  routed through the `fcop` Python library via `pythonia` (in-process
  Node ↔ Python FFI). The runtime imports `fcop.Project`,
  `fcop.Task`, `fcop.Review`, etc. directly. fcop@1.1.0's schemas
  *are* CodeFlow's schemas at runtime — there is no second copy to
  drift.
- CodeFlow's remaining responsibilities are application-layer (agent
  process control block, SDK session state, Windows EPERM atomic-write
  retry, Cursor SDK Agent driver, mobile-first PWA shell) — things
  that are genuinely outside the protocol's scope.

This is a structural simplification, not a workaround. The 5/9
proposal's premise was "CodeFlow is the reference TS implementation";
the 5/11 reframing is "CodeFlow is a first-party application on the
fcop runtime, and fcop is the only protocol authority."

### Acknowledging fcop@1.1.0's coverage of the original 5 fields

For the record — the 5 fields the original issue requested are all
present in fcop@1.1.0:

| Original (5/9 draft) | fcop@1.1.0 (5/9-5/10 shipped) |
|---|---|
| Field 1: `Agent.layer` | `Agent.layer` (ADR-0024) |
| Field 2: `Task.risk_level` | `Task.risk_level` (ADR-0025) |
| Field 3: `Review.decision = needs_human` | `Review.decision` ∈ {approve, reject, needs_human, needs_changes, abstained} (ADR-0025) |
| Field 4: `Review.human_approval` | `Review.human_approval` + `Project.mark_human_approved$()` (ADR-0025) |
| Field 5: `Skill.tools[]` risk metadata | `Skill.tools[].risk_level` (ADR-0025) |

Field 1 is generalized as `Boundary`/`layer` as discussed in the
upstream reply, which we accept without modification.

### Notes that may interest other downstream consumers

A few observations from the CodeFlow side that are non-prescriptive
(not requests to fcop, just shared field notes):

- **`pythonia` bridge** is viable for Node-stack consumers wanting to
  embed fcop in-process. Cold start ~25ms, per-call overhead ~1-7ms
  in our measurements. Surprise: `pythonia` bridges Python `dict[str,
  object]` proxies in a way that needs an explicit `.keys()`
  round-trip rather than `Object.entries`; nothing fcop needs to
  change, just a downstream-consumer note.
- **`fcop.Task` is a nested dataclass** (`task.frontmatter.sender`
  etc.); `fcop.Review` appears to be a flatter top-level shape. This
  shape difference is fine, just worth a sentence in the next docs
  pass if a consumer expects symmetry.
- **`Project(path, strict=False)`** + **`workspace_dir="docs/agents"`**
  works as an escape hatch for consumers that have not yet migrated
  to the default `fcop/` layout. This buys time for legacy projects.

These are *observations*, not asks. We'll keep using fcop@1.1.0 as
shipped and only file targeted issues when a concrete bug or
genuine emergent need surfaces.

### Closing

The clearest framing we arrived at internally is:

> *CodeFlow makes things happen. FCoP makes things happen legally.*

fcop@1.1.0 makes that division of labor real: Report (Task / Review
files), Review (decision enum + human_approval), Capability
(`risk_level` plus the boundary/skill-tools metadata that
runtimes can enforce via MCP interception). CodeFlow's job is to be
a high-quality, well-behaved tenant of that protocol layer — not to
extend it.

Will reply here again when v0.3.0-alpha ships (target ~2026-05-17)
with a short field report on actual runtime behavior under
fcop@1.1.0. If anything genuinely surprising emerges, it'll show up
there.

Thanks again for the upstream pace — shipping 1.1.0 early made the
downstream simplification possible.

— @joinwell52-AI (CodeFlow PM team)
```

---

## §一 v2 vs v1 关键差异

| 维度 | v1 (5/9 草稿) | v2 (5/11 重写) |
|---|---|---|
| CodeFlow 定位 | "reference TS implementation" | **"first-party application on the fcop runtime"** |
| `codeflow-protocol/` 命运 | "structural rewrite, mirror 7 schemas verbatim" | **"being deleted"** |
| Schema 来源 | TypeScript 镜像 | **fcop Python 库 in-process via pythonia** |
| peerDep | `"fcop": ">=1.0.0,<2.0.0"` (TS) | **`pip install "fcop>=1.1.0,<2.0.0"`** (Python) |
| Q3 答案 | "yes, will provide field evidence" + leading hypothesis | **"withdrawing" + emergence-first 原则** |
| 引用 charter | "third charter clause from human ADMIN, 13:51" | **Charter 5 (5/11 09:35 + 09:37) ADMIN 原话** |
| Boundary 立场 | "leading hypothesis: collapse into Boundary" | **"will use as-shipped, no proposed extensions"** |
| 一句话归纳 | （无） | **"CodeFlow makes things happen. FCoP makes things happen legally."** (Charter 6) |
| 5 fields 致谢表 | （无） | **新增** — 致谢 fcop@1.1.0 提前 ship 全部 5 fields |
| pythonia surprise 备录 | （无） | **新增** — DEV-005/007/009 涌现的 3 项「分享但不强求」备录 |

## §二 ADMIN 决策

| 选项 | 内容 |
|---|---|
| **a** | 用 v2 主版（含 Charter 5 引用 + Charter 6 一句话 + 5 fields 致谢表 + pythonia 备录） |
| **b** | v2 主版 - 移除 "CodeFlow makes things happen. FCoP makes things happen legally." 这句口号（Charter 6 太核心，可能不公开）|
| **c** | v2 主版 - 移除 ADMIN 5/11 09:35 + 09:37 双战略指令的逐字引用（保留意译） |
| **d** | v2 主版 - 移除 "Notes that may interest other downstream consumers" 段（pythonia/Task 嵌套/Review 平铺等技术备录），保留封闭范围 |
| **e** | 混合 b+c+d |
| **f** | ADMIN 自己改写 |

## §三 PM 推荐

**推荐 a 主版 + 可选 c（保留 ADMIN 战略指令但意译，不逐字引用）**：

理由：
1. Charter 6 一句话是 v2 的灵魂 — 它公开声明 CodeFlow 的护城河叙事，**主动塑造叙事**好过被叙事
2. ADMIN 战略指令逐字引用让 upstream 知道 CodeFlow 是「真有人在决策」而不是「AI 机械响应」— 加强 ADMIN-01 真人位
3. pythonia 备录是 v2 的实证亮点 — 让 upstream 看到 CodeFlow 在 5/9 → 5/11 已**实测落地**而非空谈
4. Q3 撤回是必须的（违反 Charter 5 + 自约束 7），不可妥协

**唯一犹豫点**：c — 是否逐字引用 ADMIN 战略指令？
- pro: 真人位 + 历史记录
- con: 公开 PM ↔ ADMIN 内部沟通节奏

**PM 自决 c 由 ADMIN 拍**：
- 若 ADMIN 觉得「不介意公开 5/11 09:35 + 09:37 那两句话」→ 用 a
- 若 ADMIN 觉得「这两句是私下指令，公开意译即可」→ 改 c：「the CodeFlow human ADMIN clarified internally on 2026-05-11 that CodeFlow must operate as an application on the fcop protocol, with emergent needs reported but not pre-designed」

## §四 与 DRAFT-20260509-001 的衔接

| 项 | 处置 |
|---|---|
| 原 DRAFT-001 是否删除？ | **不删**。保留作为「PM 5/9 时点判断快照」入 emergence-log §3 PM 第 4 次错误自披露的物证 |
| 本 DRAFT v2 取代 v1 的字段 | YAML frontmatter `supersedes: [DRAFT-20260509-001]` 已声明 |
| 如 ADMIN 拍 a → b → c | PM 起草 v3 |
| 如 ADMIN 自己改写 → f | PM 不再起草，等 ADMIN 改完后存档 |

---

PM-01
2026-05-11 14:50 (UTC+8)
等 ADMIN 在 a / b / c / d / e / f 拍板（v2 草稿）
