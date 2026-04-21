# FCoP 致 ADMIN 的一封信 —— 说明书

你好，ADMIN。

我是 **FCoP**（File-based Coordination Protocol）——让你和 AI 团队
通过**文件**协作的协议。你唯一要做的事：**告诉我你这个项目是几个人、
怎么分工。**

---

## 先把身份说清楚

一张图：

```
   人类                              AI 团队
┌─────────┐                   ┌──────────────────────┐
│  ADMIN  │◄──── TASK-*.md ──►│  leader              │
│  (你)   │                   │    │                 │
└─────────┘                   │    ├──► AI 角色 2    │
                              │    ├──► AI 角色 3    │
                              │    └──► AI 角色 4    │
                              └──────────────────────┘
```

| 身份 | 谁 | 说明 |
|---|---|---|
| **真人** | 你 | 角色代码永远是 `ADMIN`，有且只有 1 个 |
| **AI 团队** | N 个 Agent | 你自己命名的 N 个"岗位"（`PM` / `MANAGER` / `ME` …） |

- `ADMIN` **不写进 `fcop.json.roles`**，它是 FCoP 的保留角色。
- 你的指令只发给 **leader**；leader 自己决定要不要派给其他 AI（Rule 4）。
- Solo 模式下"团队"里只有 1 个 AI，但它仍然不是你——它是你的 AI 助手。

---

## 三种起手方式（按常用度排序）

### A. 只有你一个（Solo，最常用）

一句话交给 Agent：

> **"用 Solo 模式初始化项目，角色代码叫 `ME`。"**

对应工具：

```
init_solo(role_code="ME", role_label="我自己", lang="zh")
```

Solo = 一人多角色。你（`ADMIN`）和这个 AI（`ME`）直接对话，不走多级派单。
但 **Rule 0.b 仍然适用**：AI 会先写提案文件 → 动手 → 再读回自己的提案
做自审，用文件把"提案者"和"审查者"劈开。

### B. 用一套预设班子

> **"用预设团队 `dev-team` 初始化项目。"**

| 模板 | 适用 | AI 角色 | leader |
|---|---|---|---|
| `dev-team` | 软件开发 | `PM` · `DEV` · `QA` · `OPS` | `PM` |
| `media-team` | 内容创作 | `PUBLISHER` · `COLLECTOR` · `WRITER` · `EDITOR` | `PUBLISHER` |
| `mvp-team` | 创业 MVP | `MARKETER` · `RESEARCHER` · `DESIGNER` · `BUILDER` | `MARKETER` |

对应工具：`init_project(team="dev-team", lang="zh")`

### C. 自己搭角色

**标准句式：**

> **"我要组一个 AI 团队：4 个 AI 角色——`MANAGER` 做 leader，加上
> `CODER`、`TESTER`、`ARTIST`；团队名叫'我的设计工作室'，中文界面。"**

对应工具：

```
create_custom_team(
  team_name="我的设计工作室",
  roles="MANAGER,CODER,TESTER,ARTIST",
  leader="MANAGER",
  lang="zh"
)
```

---

## 自建角色的硬规则

角色代码会直接拼进文件名（`TASK-20260417-001-MANAGER-to-CODER.md`），
所以规矩来自文件名：

| 项 | 要求 | 对 ✅ | 错 ❌ |
|---|---|---|---|
| 角色代码 | 大写英文字母开头，只用 `A-Z` `0-9` `_` | `MANAGER` `QA1` `CODER_A` | `程序员` `DEV-TEAM` `QA.1` `my boss` |
| 角色个数 | ≥ 2（只想一个人走 Solo） | `MANAGER,CODER` | 只有 `MANAGER` |
| Leader | 必须在角色名单里 | leader=`MANAGER` | leader=`CEO`（不在名单里） |
| 保留字 | 不能用 `ADMIN` `SYSTEM` 当角色代码 | `MANAGER` | `ADMIN` `SYSTEM` |
| 团队名 | 随便写，中英皆可（只用来显示） | "我的设计工作室" | —— |
| 语言 | `zh` 或 `en` | `zh` | `中文` `Chinese` |

**命名建议**（避免歧义）：

- ✅ 用**职能词**：`MANAGER` / `CODER` / `WRITER` / `EDITOR` / `PM` / `DEV` / `QA`
- ✅ 用**全大写拼音**：`JINGLI`（经理）/ `CHENGXU`（程序）/ `CESHI`（测试）
- ❌ 避开**权威词**：`BOSS` / `CHIEF` / `MASTER` / `OWNER` / `CEO` / `KING`
  —— 真正的"老板"是你（ADMIN），AI 不该戴这顶帽子。
- ❌ **禁止中文**：文件名规则硬性要求 ASCII。

**不确定合不合法？** 让 Agent 先调：

```
validate_team_config(roles="MANAGER,CODER,TESTER,ARTIST", leader="MANAGER")
```

合法返回"OK"，不合法直接告诉你哪个字段怎么坏的。

---

## 起完之后会落下这些东西

```
项目根/
├── docs/agents/
│   ├── fcop.json            ← 项目身份（mode / roles / leader）
│   ├── tasks/               ← 派发中的任务
│   ├── reports/             ← 回执
│   ├── issues/              ← 问题单
│   ├── shared/              ← 共享文档（看板、术语表…）
│   ├── log/                 ← 归档
│   └── LETTER-TO-ADMIN.md   ← 这封信本身，留个底
└── .cursor/rules/
    ├── fcop-rules.mdc       ← 协议规则（Cursor 下每个 Agent 自动读）
    └── fcop-protocol.mdc    ← 协议解释
```

你以后的每一句话都会变成一份文件：

```
TASK-20260417-001-ADMIN-to-MANAGER.md    ← 你的指令
TASK-20260417-001-MANAGER-to-ADMIN.md    ← MANAGER 的回执
```

**这就是 FCoP 的全部。**

---

## 四条必读规则（缩略版）

| # | 规则 | 一句话 |
|---|---|---|
| 0.a | 落文件 | 聊天里的话没落成文件 = 没发生 |
| 0.b | 多角色制衡 | 不允许一个 AI 独自完成决策到执行 |
| **0.c** | **只落真话** | **不捏造、不臆断、引用必带出处** |
| 1 | UNBOUND | Agent 新会话先调 `unbound_report()`，等你指派身份 |

完整 9 条在 `.cursor/rules/fcop-rules.mdc`（Agent 会自动读）。
协议解释（命名、YAML、目录、巡检、0.c 的出处格式等）在
`.cursor/rules/fcop-protocol.mdc`。

---

## 不满意怎么办

- 想看完整规则 → 让 Agent 读 `fcop://rules` 或 `fcop://protocol`
- 对协议本身有意见 → 让 Agent 调 `drop_suggestion("...", "...")`，
  反馈落到 `.fcop/proposals/`，不污染协作目录
- 想换模板 → 一句话："用 `{team}` 重新初始化"
- 又想看这封信 → `fcop://letter/zh` 或 `docs/agents/LETTER-TO-ADMIN.md`

欢迎上岗。

— **FCoP**
