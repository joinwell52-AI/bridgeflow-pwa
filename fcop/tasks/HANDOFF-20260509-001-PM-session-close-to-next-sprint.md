---
protocol: fcop
version: 1
kind: handoff
handoff_id: HANDOFF-20260509-001
sender: PM-01 (current chat session)
recipient: PM-01 (next chat session) + ADMIN
priority: P0
thread_key: session-handoff-v2-launch-to-next-sprint
references:
  - docs/design/codeflow-v2-on-fcop-sdk.md
  - docs/agents/CURRENT-ROLES.md
  - REPORT-20260509-011-PM-to-ADMIN
  - REPORT-20260509-012-PM-to-ADMIN
  - https://github.com/joinwell52-AI/FCoP/issues/2
notice: 本文件是 PM 会话交接备忘录，不是 task 也不是 report，是给"下一个 PM-01 会话"和 ADMIN 看的开场指南
---

# PM-01 会话交接 — v2 启动收官 → 下一 Sprint 开始

> ADMIN 5/9 11:55 决策：**close 当前 PM-01 chat，新开 Sprint 专用 chat**。
> 本文件 = 新会话的"开场入口"。新 PM-01 第一次发言前必读。

---

## 0. 30 秒接手摘要（新 PM-01 看这一段就能上手）

| 你接手时 | 当前状态 |
|---|---|
| **项目身份** | CodeFlow AI Runtime（v1 → v2 身份反转已完成）|
| **核心宪法** | `docs/design/codeflow-v2-on-fcop-sdk.md` §0.0 项目宪法 + 5 条硬规则 |
| **代码状态** | git HEAD = `04b3cdf`，origin + backup 已同步，gitee 分叉未推（待 ADMIN 决策）|
| **下一动作** | Sprint S1（**不是 S3**，见 §3 澄清）— Skeleton + 协议 freeze |
| **未决事项** | 见下面 §4，3 件 |
| **绝对红线** | §6，4 条不能动 |
| **第一动作建议** | §7 给 ADMIN 一个开场回执 |

---

## 1. 你接手的项目是什么（30 秒）

**CodeFlow AI Runtime** — 一个面向多 Agent 协作开发的轻量级 AI Runtime / AI OS。

- **不是**：Cursor 插件 / 聊天工具 / SaaS / 自动写代码
- **是**：用 Cursor SDK 驱动多 Agent，靠 fcop-mcp 提供文件化协议纪律，实现"AI 团队稳定工作的操作系统内核"
- **护城河**：Agent Governability（让概率性 LLM 可治理）+ Mobile-first Governance（人类用手机审批高风险）
- **当前阶段**：v2 文档闭合 + 协议 freeze 准备，距离 v0.1 backend kernel 跑通约 6 sprint

---

## 2. 必读路径（按顺序，约 25 分钟）

### 必读 #1（最重要）— 设计文档全文
**`docs/design/codeflow-v2-on-fcop-sdk.md`** （2389 行）

> ⭐ ADMIN 5/9 11:55 原话："这个文档**其实是后面的核心内容**"
> 后续任何动作前必须先回这里对齐。

关键章节地图（如果时间紧，至少看这 6 节）：

| 章节 | 行号 | 为什么必读 |
|---|---|---|
| §0.0 Executive Summary | 17-35 | **项目宪法**（ADMIN 两句话锁定身份）|
| §0.6 AI OS 雏形论 | ~270-450 | 三层栈 + 护城河 + Docker 前夜类比 |
| §0.8 v0.1 唯一目标 + 6 条硬约束 | ~600-800 | "什么算完成 v0.1"的判定 |
| §0.9 Mobile-first Governance | ~800-1100 | Mobile 不是 UI 美化，是治理面 |
| §3 五类 Schema | ~1200-1700 | 协议本体，Sprint S1 要 freeze 的就是这个 |
| §8.0 5 条硬规则 | ~1900-2050 | **绝对红线**，违反 = 项目失去自洽性 |
| §8.6 LEGACY 退役账本 + backlog | ~2080-2200 | 已删什么 / 还剩什么 / SOP |
| §10 路线图（Sprint Plan） | 2210-2340 | 下一步具体做什么 |

### 必读 #2 — 角色配置一张表
**`docs/agents/CURRENT-ROLES.md`** （236 行）

dev-team 5 角色（PM/DEV/OPS/QA/REVIEW）的三源对照表。**任何"角色到底干什么"的疑问回这里查**，不要发明新角色。

### 必读 #3 — v2 对外速读版
**`docs/codeflow-overview.md`** （约 350 行）

5 分钟读完，给非技术读者看的版本，**也是新 PM-01 验证自己有没有理解 v2 的快速测试**：你能不能用这个文档的语言对 ADMIN 解释 v2？能 = 接对了。

### 必读 #4 — 上一会话的两份关键 PM-to-ADMIN
- `REPORT-20260509-011-PM-to-ADMIN.md` — pre-S1 housekeeping 收尾
- `REPORT-20260509-012-PM-to-ADMIN.md` — R2 备份 + gitee 分叉决策选项

读完这两份你就掌握了"今天 5/8 晚 → 5/9 上午"全过程的核心结论。

### 选读 — 协议提案上游
**FCoP Issue #2** — https://github.com/joinwell52-AI/FCoP/issues/2

你提议给 FCoP 加 5 个 runtime governance 字段（layer / risk_level / needs_human / human_approval / tools[].risk_level）。**仍 OPEN，等上游 maintainer 反馈**。

---

## 3. 命名澄清（重要！避免新会话接错）

⚠️ **"Sprint S3" vs "Sprint S1" 语义混淆**

之前几份 PM-to-ADMIN（REPORT-010/011/012）里 PM 用「Sprint S3」一词，但其实是**口语占位符**，意思是"pre-housekeeping 之后的下一个 sprint"。

**按 §10.2 路线图严格定义**：

| 占位符 | 真实身份 | 主题 | 关键交付 |
|---|---|---|---|
| ~~"Sprint S3"（PM 口误）~~ | **Sprint S1** | Skeleton + 协议 freeze | TS 包结构 + §3 五类 schema 的 JSON Schema 文件 + 校验工具 |

历史命名"S3"来自更早期某版路线图（已淘汰）。**新会话一律用 S1/S2/.../S6 = §10.2 的官方 sprint 编号**。

---

## 4. 未决事项（3 件等 ADMIN 拍板）

新 PM-01 上手第一件事：用一句话问 ADMIN 这 3 个状态，避免漏拍。

### #1 gitee 分叉怎么办？

来源：`REPORT-20260509-012-PM-to-ADMIN.md` §"gitee 分叉 3 选项"

| 选项 | 说明 | OPS+PM 推荐度 |
|---|---|---|
| **G1** force-push 覆盖 | 不可逆，丢 gitee 上 3 个独立 commit | ⭐ |
| **G2** rebase 三仓 | 复杂，污染 main history | ⭐ |
| **G3** 暂不动 | 0 风险，gitee 凝固在 v2.12.0 时代 | **⭐⭐⭐** |

→ **新 PM-01 不能擅自做 G1/G2**（违反 git safety + ops-bridge 高危规则）。等 ADMIN 一句话即可。

### #2 Sprint S1 立刻启动 vs 等 FCoP Issue #2 反馈？

| 选项 | 说明 |
|---|---|
| **立刻启动** | 在不依赖 §3 新字段的前提下做 codeflow-runtime 骨架（先做 §10.2 S1 的 TS 包结构 + 校验工具）|
| **等反馈** | 全队"待命 + 监听"，每天 1 次 check Issue #2 评论 |

PM 推荐：**立刻启动**。理由：S1 主交付物（TS 包骨架 + JSON Schema 文件）即使 Issue #2 改了字段也只需重新 export，损失小；而等待是无限期。

### #3 本次会话新增 3 个 task 文件没 push

来源：`REPORT-20260509-012-PM-to-ADMIN.md` 末尾"⚠️ 注意"段

未在 git/origin/backup 上的本地新文件（push 之后才写的）：
- `docs/agents/tasks/TASK-20260509-008-PM-to-OPS.md`
- `docs/agents/tasks/REPORT-20260509-008-OPS-to-PM.md`
- `docs/agents/tasks/REPORT-20260509-012-PM-to-ADMIN.md`
- 加上本文件 `HANDOFF-20260509-001-PM-session-close-to-next-sprint.md`

→ **新 PM-01 第一次 commit 时记得带上这 4 个文件**，建议 commit message：
```
docs(handoff): R2 backup + session handoff to next sprint
```

---

## 5. 项目状态快照（5/9 11:55 凝固）

### git 三仓状态
```
local        : 04b3cdf  ━━ ✅ 含本地 4 个未追加文件 (HANDOFF + TASK-008 + REPORT-008/012)
origin/main  : 04b3cdf  ━━ ✅ 同步
backup/main  : 04b3cdf  ━━ ✅ 同步
gitee/main   : 62532a7  ━━ ⚠️ 分叉 (v2.12.0 时代，待决策)
```

### tasks/ 目录
```
docs/agents/tasks/
├── README.md
├── _archive/
│   ├── README.md
│   └── 2026-04/  (33 历史文件)
├── HANDOFF-20260509-001-...md           ← 本文件
├── REPORT-20260509-001 ~ 012            ← 各活跃 thread 报告
├── TASK-20260509-002 ~ 008              ← PM 派单
└── (TASK-005 已 SUPERSEDED)
```

### 5 条硬规则（5/9 状态）
| # | 规则 | 兑现状态 |
|---|---|---|
| 1 | v2 是身份反转，不是 v1 升级 | ✅ |
| 2 | fcop-mcp/ 已物理删除（5/9） | ✅ |
| 3 | brief_file 引用 `.codeflow/briefs/PM.md` | ✅（Schema 已写）|
| 4 | 协议演进唯一合法仓 = `D:\FCoP` | ✅ Issue #2 已推 |
| 5 | codeflow-pwa 是 fcop 消费者，**不是定义者/分发者** | ✅ 9 项已删 |

### §8.6 backlog 残余（11 项）
| # | 项 | 优先级 | 状态 |
|---|---|---|---|
| 4 | `docs/integrations/fcop-standalone-zh.md` 全文重写 | P2 | 🟡 部分（A1 加了一节）|
| 5 | `codeflow-plugin/` 剩余资产搬到 `.codeflow/` | P2 | ⏸ S1 启动后做 |
| 6 | `_ignore/audit_fcop_*` 是否清理 | P2 | ⏸ |
| 7 | `CHANGELOG.md` 添加 5/9 退役条目 | P2 | ⏸ |
| 8 | `docs/release-process.md` 更新跨仓发版流程 | P3 | ⏸ |
| 11 | 写脚本自动生成 CURRENT-ROLES.md | P3 | ⏸ |
| 12 | gitee 分叉决策（G1/G2/G3） | P0 | ⏸ 等 ADMIN |

### 部署/服务状态
- 没启动任何 daemon / runtime（v0.1 还没开始，没东西可启动）
- WebSocket relay 仍按 v1 配置在某中继上跑（与本仓无关）
- Cursor Desktop EXE 用户拿到的还是 v2.12.17（没动 EXE 发版）

---

## 6. 红线（绝对不能违反）

### 6.1 项目宪法 2 句（设计文档 §0.0）
> 1. "这个项目文件就是码流的，目前项目是用 cursor 的 sdk，应用 fcop-mcp"
> 2. "码流是做成一个 CodeFlow 的真正定位：一个面向多 Agent 协作开发的轻量级 AI Runtime / AI OS"

新 PM-01 任何动作如果**与这两句产生矛盾**，立刻停下问 ADMIN。

### 6.2 5 条硬规则（设计文档 §8.0）
违反 = 项目失去自洽性。特别注意硬规则 #5：

> ⛔ **不能在本仓做 fcop 的定义、分发、安装步骤**。任何"教用户怎么装 fcop"的内容只能链到上游 README + PyPI。本仓只 *消费*。

### 6.3 git safety
- **不擅自做 force-push / hard reset / push --all** — 上一会话已经守住了 gitee 分叉
- **不动 .git/config**
- **commit 必须语义清晰**（feat/fix/chore/docs/refactor，按 conventional commits）

### 6.4 文件编辑规则（CodeFlow 项目规范）
- **改含中文文件必须用 Python 脚本**，禁止 PowerShell `-replace` / `Set-Content`（会变 GBK 乱码）
- **不修改 `docs/agents/tasks/` 已有 task 文件**，只追加（superseded 例外，加 frontmatter）
- **不要绕开 PM 直接派 DEV/OPS/QA**（admin-human-bridge 规则）

---

## 7. 新 PM-01 第一动作建议

### 7.1 开场回执模板（给 ADMIN）

```markdown
PM-01 上线。已读 HANDOFF-20260509-001。

接手状态：
- 项目身份：CodeFlow AI Runtime（v2 已闭合）
- 当前阶段：v2 文档闭合 → Sprint S1 启动前
- git HEAD：04b3cdf（origin/backup 同步，gitee 分叉）
- 未决 3 件：
  1. gitee 分叉怎么办？G1/G2/G3 选一
  2. Sprint S1 立刻启动 vs 等 FCoP Issue #2？PM 推荐立刻启动
  3. 4 个未追加文件下次 commit 一起带上

请 ADMIN 拍板上述 3 件后，PM 进入工作模式。
```

### 7.2 自检清单（在回 ADMIN 之前先打勾）

- [ ] 已读 `docs/design/codeflow-v2-on-fcop-sdk.md` §0、§8、§10（三大核心节）
- [ ] 已读 `docs/agents/CURRENT-ROLES.md`（角色对照表）
- [ ] 已读 `REPORT-20260509-011` + `REPORT-20260509-012`（最近两份 PM-to-ADMIN）
- [ ] 已扫 `docs/agents/tasks/` root 一眼（确认 15 个文件 + _archive 子目录）
- [ ] 知道"Sprint S3" 是历史口误，正确叫 **Sprint S1**
- [ ] 知道 5 条硬规则 + 红线
- [ ] 知道改中文文件用 Python 不用 PowerShell
- [ ] 知道 gitee 分叉 = 不擅自 force-push

### 7.3 不要做的事

- ❌ 重新发明 v2 定位 / 重新阐述项目身份（直接复用宪法 2 句）
- ❌ 重新设计 5 类 schema（已 freeze 在 §3，要改去 D:\FCoP 提 Issue）
- ❌ 重新派 housekeeping 类小任务（已经 5/8-5/9 做完了）
- ❌ 立刻动手写 codeflow-runtime 代码（先等 ADMIN 拍 #2 决策）
- ❌ 立刻 commit + push（先等 #1 + #2 拍板，下次 commit 带 4 个文件一起）

---

## 8. 上下文压缩：本会话主要思想线索（约 50 词）

5/8 晚 ADMIN 提出 fcop 配置漂移问题 → PM 拉清单 → 发现"v1 时代外挂"和"v2 时代 runtime"在同一仓造成逻辑冲突 →
诞生 5 条硬规则（其中 #5 = codeflow-pwa 不能定义/分发 fcop）→ 物理删除 9 项 fcop 定义内容 →
设计文档 §0.0 嵌入宪法 + §8.6 退役账本 + §10 6-sprint 路线图 →
5 个外部文档嵌入精简宪法块 → FCoP Issue #2 推送（提议 5 个 runtime governance 字段）→
A1+B1+C1 housekeeping（fcop guide + roles map + tasks 归档）→ R2 三仓备份（origin+backup ✅，gitee 分叉等决策）→
本会话收官 → 移交下一 Sprint。

**核心主线**：v1 → v2 身份反转 + 协议纪律建立 + 上游协调启动。

---

## 9. 上一会话的两条关键 git commit（不要回退）

```
04b3cdf  chore(s3-prep): pre-Sprint-S3 housekeeping — fcop guide + roles map + tasks archive
6595427  feat(v2): launch CodeFlow AI Runtime — design, schemas, charter, hard rule #5 purge
```

> 注意：commit message 里的"Sprint-S3"是历史命名（见 §3 澄清），实际就是 Sprint S1 启动前的 housekeeping。
> **不要为了改名重写历史**（会触发 force-push，违反 git safety）。

---

## 10. 联络方式（仍然只在文件里说话）

按 CodeFlow 协议：
- 新 PM-01 ↔ ADMIN：写 `TASK-{date}-{seq}-ADMIN-to-PM.md` / `REPORT-{date}-{seq}-PM-to-ADMIN.md`
- 新 PM-01 ↔ DEV/OPS/QA：写 `TASK-{date}-{seq}-PM-to-{ROLE}.md` / `REPORT-{date}-{seq}-{ROLE}-to-PM.md`
- 协议演进：去 `D:\FCoP` 仓提 Issue 或 PR，**不在本仓做协议定义**

---

## 11. 本会话主要产物索引

| 文件 | 类型 | 作用 |
|---|---|---|
| `docs/design/codeflow-v2-on-fcop-sdk.md` | 设计 | **核心文档**，新会话第一必读 |
| `docs/codeflow-overview.md` + `.en.md` | 对外 | 5 分钟速读版 |
| `docs/agents/CURRENT-ROLES.md` | 角色 | 三源对照表 |
| `docs/integrations/fcop-standalone-zh.md` | 集成 | contributor 接 fcop-mcp 指引 |
| `docs/agents/tasks/_archive/` | 归档 | 33 个历史 task |
| `README.md` + `.en.md` + `.zh.md` | 入口 | 顶部宪法块 |
| `_ignore/fcop-issue-draft.md` + `_ignore/fcop-issue-body.md` | 草稿 | FCoP Issue #2 来源 |
| 11 份 5/9 PM/DEV/OPS task & report | 流程 | 完整对话纸本 |
| 本 HANDOFF-001 | 交接 | 你正在读的文件 |

---

**当前会话 PM-01 签收：v2 启动收官，会话清场，移交下一 PM-01。**

**下一会话 PM-01 接手指令**：先读这份文件，再读 §0+§8+§10，再回 ADMIN 一段开场回执（§7.1 模板）。
