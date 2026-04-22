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

## 主动校验：你随口说，FCoP 自动拦

**你不用读上面的规矩**。以下三种情况 FCoP 都会**在落盘前拦住**并
给出中英双语的具体原因——不是"失败/成功"，是**哪个字段哪个字符坏了、怎么改**。

| 你随口说 | Agent 会试着调 | FCoP 拦截，原因 |
|---|---|---|
| "组一个 4 人团队：`BOSS` `程序员` `测试` `设计师`" | `create_custom_team(roles="BOSS,程序员,...")` | ❌ 角色代码 `'程序员'` 非法：不允许中文 |
| "角色叫 `DEV-TEAM` 和 `QA-1`" | `create_custom_team(roles="DEV-TEAM,QA-1,...")` | ❌ 角色代码 `'DEV-TEAM'` 非法：不允许 `-`（会把文件名分隔符搞乱） |
| "角色叫 `my boss`" | `create_custom_team(roles="my boss,...")` | ❌ 角色代码 `'my boss'` 非法：不允许空格，必须大写开头 |
| "角色叫 `QA.1`" | `create_custom_team(roles="QA.1,...")` | ❌ 角色代码 `'QA.1'` 非法：不允许 `.` |
| "把 `ADMIN` 也加进团队" | `create_custom_team(roles="ADMIN,CODER,...")` | ❌ `'ADMIN'` 是 FCoP 保留字，真人用，不能给 AI 戴 |
| "就一个角色 `MANAGER`" | `create_custom_team(roles="MANAGER", ...)` | ❌ 至少需要 2 个角色；想单人请用 `init_solo(...)` |
| "leader 是 `CEO`，角色是 `MANAGER, CODER`" | `create_custom_team(roles="MANAGER,CODER", leader="CEO")` | ❌ `leader 'CEO'` 必须在角色列表里（当前：`MANAGER, CODER`） |
| "`CODER`, `CODER`, `QA`" | `create_custom_team(roles="CODER,CODER,QA", ...)` | ❌ 角色代码 `'CODER'` 重复 |

> **0.4.6 起错误消息会"手把手教你改"**：比如你说 `DEV-TEAM`，FCoP 会
> 直接回：`建议改为 DEV_TEAM（已自动修正大小写/分隔符）`。你说
> `my boss` → `建议改为 MY_BOSS`。你把 `leader` 大小写搞错 →
> `看起来你可能想选 'MANAGER'？`（did-you-mean）。建议**只是提示**，
> 最终名字永远是你定。

**一共 9 条校验项**（都跑在 `create_custom_team` / `init_solo` 里，你调了就自动过）：

1. 角色代码非空
2. 必须匹配 `^[A-Z][A-Z0-9_]*$`（大写字母开头，只能用 `A-Z` / `0-9` / `_`）
3. 禁止中文、`-`、`.`、空格
4. 不能是 `ADMIN`（真人保留）
5. 不能是 `SYSTEM`（FCoP 内部保留）
6. 非 Solo 模式下至少 2 个角色（只想单人 → 让 Agent 改用 `init_solo`）
7. 角色列表不允许重复
8. `leader` 必须是角色列表里的一员
9. 每个错误都返回**可读错误信息**（中英双语），不是布尔值

**想在动手前先验一下？** 让 Agent 调：

```
validate_team_config(roles="MANAGER,CODER,TESTER,ARTIST", leader="MANAGER")
```

不写任何文件，合法返回 `OK`，不合法直接告诉你坏在哪。适合你口述
一堆角色但不确定有没有非法字符时，让 Agent 先跑一遍。

**重点：你不用记规则。** 直接跟 Agent 自然语言说你想要啥团队，它调
`create_custom_team` 就自动过这 9 条校验，过不了会**拿着具体原因回来问你**。

---

## 起完之后会落下这些东西

```
项目根/
├── docs/agents/             ← 协作元数据（谁在做什么）
│   ├── fcop.json            ← 项目身份（mode / roles / leader）
│   ├── tasks/               ← 派发中的任务
│   ├── reports/             ← 回执
│   ├── issues/              ← 问题单
│   ├── shared/              ← 共享文档（看板、术语表…）
│   ├── log/                 ← 归档
│   └── LETTER-TO-ADMIN.md   ← 这封信本身，留个底
├── workspace/               ← ★ 产物家（代码、脚本、数据）★
│   └── README.md            ← 约定说明
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

## 产物放哪：`workspace/<slug>/` 约定

这是一个很多人第一天不会意识到、第二天就翻车的问题——

**你让 Agent 做 CSDN 搜索工具，它把 `app.py`、`pyproject.toml`、
`*.bat` 全扔到项目根。第二天你让它做小游戏，`pyproject.toml` 打架，
`app.py` 被覆盖，`*.bat` 混在一起分不清是哪个的。**

FCoP 0.4.7 把答案内建到了初始化流程里：**项目根只放协作元数据，
具体产物全部进 `workspace/<slug>/`。一个"要做的事"一个 slug，互不打扰。**

```
codeflow-3/
├── .cursor/ docs/ fcop.json LETTER-TO-ADMIN.md   ← 协作骨架，永不混
└── workspace/
    ├── csdn-search/         ← 今天：CSDN 文章搜索
    │   ├── app.py
    │   ├── templates/
    │   ├── *.bat
    │   └── pyproject.toml
    └── mini-game/           ← 明天：小游戏（独立笼子，和 csdn-search 完全隔离）
        ├── game.py
        └── assets/
```

### 怎么开一个新笼子

两种方式，都合法：

1. **让 Agent 调工具**（推荐）：

    ```
    new_workspace(slug="csdn-search", title="CSDN 文章搜索工具")
    ```

    FCoP 自动建目录、写一份最小 README、落一个 `.workspace.json` 元
    数据文件。

2. **你自己 `mkdir`**：直接在 `workspace/` 下新建文件夹，Agent 一样
    认账，`list_workspaces()` 也能看见。

### slug 命名规则（FCoP 自动校验）

| ✅ 合法 | ❌ 不合法 | 为什么 |
|---|---|---|
| `csdn-search` | `CSDN-Search` | 必须小写 |
| `mini-game` | `mini_game` | 只能用 `-` 做分隔符（和角色代码反过来） |
| `weekly-report-2026w17` | `周报` | 不允许中文 |
| `api-v2` | `my game` | 不允许空格 |
| `search` | `tmp` / `shared` / `archive` | 保留字 |

和角色代码一样，输错了会拿到"建议改为 `xxx`"的友好修复提示，最长 40 个字符。

### 一键查看

想知道项目里有几个笼子、分别是啥，让 Agent 调：

```
list_workspaces()
```

输出每个 slug 的 title 和创建时间。`get_team_status()` 也会顺便
告诉你工作区数量。

### 硬规矩

- ❌ Agent **不得往项目根写业务代码**（`app.py` / `pyproject.toml` 这类）
- ❌ 不同 slug 之间不共享文件
- ✅ 需要在多个笼子之间共享的东西，自己开 `workspace/shared/`
  （FCoP 给这个 slug 留了保留字）

---

## MCP 功能一览（ADMIN 必看）

装上 `fcop` MCP 后，你的 Agent 能调用 **19 个工具** 和 **6 个资源**。
下表按"必须 / 可选 / 救场"三档列全，你不用全记，知道有就行。

### 🔴 必经流程（每个项目第一天都会用上）

| 工具 | 何时调 | 必须？ | 作用 |
|---|---|---|---|
| `unbound_report()` | **每次新会话的第一个动作** | **必须** | Rule 0 强制；没初始化→返回初始化汇报（Phase 1），已初始化但没角色→返回 UNBOUND 汇报（Phase 2） |
| `init_solo()` 或 `init_project()` 或 `create_custom_team()` | 项目**第一次**打开时 | **必须三选一** | 写 `fcop.json`、建目录、部署规则文件和这封信。没跑过它 FCoP 就没启用 |
| `set_project_dir("E:\\你的项目")` | MCP 绑错目录（`unbound_report` 里看到"项目路径：C:\Users\xxx"）时 | **救场时必须** | 运行时重绑项目根，不用改 `mcp.json`、不用重启 Cursor |

### 🟡 日常可用（按需，不强制）

**做事的**（分配角色后才允许调）：

| 工具 | 作用 | 典型用法 |
|---|---|---|
| `list_tasks()` | 列 `tasks/` 下所有未归档任务（含 frontmatter 元数据） | 接班/交接时 |
| `read_task(path)` | 读某份任务正文 | 被指派后第一步 |
| `write_task(...)` | 写一份新任务（自动校验文件名和 frontmatter） | 派单/回执 |
| `inspect_task(path)` | 只读 frontmatter，不读正文（UNBOUND 期间也能调） | 巡检/审计 |
| `list_reports()` / `read_report(path)` | 列/读完成回执 | 复盘、交接 |
| `list_issues()` | 列问题单 | 故障排查 |
| `archive_task(path)` | 把处理完的任务归档到 `log/` | 定期清理 |

**看状态的**（纯只读，UNBOUND 也能调）：

| 工具 | 作用 |
|---|---|
| `get_team_status()` | 任务/回执/问题数量 + 近期活跃 + 工作区列表 |
| `get_available_teams()` | 列出所有预设团队（Solo / dev-team / media-team / mvp-team） |
| `validate_team_config(roles, leader)` | **自建团队前**预检角色代码合不合法，不落盘 |
| `new_workspace(slug, title, description)` | 开一个产物笼子 `workspace/<slug>/`（见"产物放哪"一节） |
| `list_workspaces()` | 列当前项目里所有 `workspace/<slug>/` 笼子及元数据 |

**协议反馈**（对协议本身有意见用）：

| 工具 | 作用 |
|---|---|
| `drop_suggestion(title, body)` | 反馈落到 `.fcop/proposals/`，不污染 `docs/agents/` |

### 🟢 资源（Agent 被动读，你不用管）

| 资源 URI | 内容 | 你会用到的场景 |
|---|---|---|
| `fcop://rules` | `fcop-rules.mdc` 原文（协议规则 9 条） | 想让 Agent 重读规则 |
| `fcop://protocol` | `fcop-protocol.mdc` 原文（协议解释） | 想看命名/YAML/目录的具体规定 |
| `fcop://letter/zh` 或 `/en` | 这封信本身 | 想再读一次说明书 |
| `fcop://status` | 项目当前状态（同 `get_team_status`） | 低频 |
| `fcop://config` | `fcop.json` 原文 | 低频 |

### ⚠️ Cursor 面板上的"点灰"开关

打开 Cursor 的 MCP 设置，能看到这 19 个工具每个旁边都有个按钮，
**点一下会变灰 = 禁用**，再点一下变白 = 启用。这是 Cursor 的工具级
开关，不是 FCoP 的功能。

- ✅ 可以灰掉的：日常可选里那些你项目用不上的（比如纯对话项目可以
  灰掉 `archive_task` `list_issues` 减少噪音）
- ❌ **千万别灰的两个**：
  - `unbound_report` —— 灰了它 Rule 0 直接失效，新会话 Agent 没法
    做第一步
  - `set_project_dir` —— 灰了它 MCP 绑错目录时你只能改 `mcp.json` +
    重启 Cursor

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
