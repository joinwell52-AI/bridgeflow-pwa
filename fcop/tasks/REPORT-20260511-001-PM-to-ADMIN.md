---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260511-001
sender: PM
recipient: ADMIN
priority: P0
thread_key: codeflow-v0.2.0-beta-2-ship-milestone-and-strategy-pivot-charter-5
references:
  - REPORT-20260510-014-OPS-to-PM
  - REPORT-20260510-014-QA-to-PM
  - REPORT-20260510-013-DEV-to-PM
  - REPORT-20260510-012-DEV-to-PM
  - REPORT-20260510-011-OPS-to-PM
  - REPORT-20260510-011-QA-to-PM
layer: governance
---

# REPORT-20260511-001：v0.2.0-beta.2 出厂里程碑 + 战略转向 Charter 5 入档 + BUG-SDK-007 派单

## 一句话回放

**v0.2.0-beta.2 已落地**（commit `ffa1f32` + `70422ba`，本地 tag `v0.2.0-beta.2`，main 推 origin/backup），**4 BUG（SDK-001/002/003/004）全部 closed**（单元强证 109/109）；smoke 揭示 **BUG-SDK-007**（ADMIN key + `Agent.create` 传 model 100% 拒绝）— PM 已自决派 TASK-001 hotfix 走 `v0.2.0-beta.3`；同时 ADMIN 今晨双战略指令（FCoP-as-AI-OS + 涌现优先）已立项为 **Charter 第 5 条**，配套 **PM 自约束第 6/7 条** 同步生效，待 v0.2.0-beta.3 ship 后批量入档 commit。

## 一、v0.2.0-beta.2 出厂里程碑

### 1.1 OPS-014 完工证据

| 项 | 值 |
|---|---|
| Commit A（hotfix bundle）| `ffa1f32 fix(s6-v0.2-sprint0-mt2-mt3-mt4): three hotfixes for v0.2.0-beta.2`（10 files, +538/-35） |
| Commit B（docs archive）| `70422ba docs(s6-v0.2-sprint0-mt2-mt3-mt4-archive): hotfix dispatch and reports`（8 files, +1933） |
| 本地 tag | `v0.2.0-beta.2 → ffa1f32` |
| origin/main | `70422ba`（与 local 一致 ✅） |
| backup/main | `70422ba`（与 local 一致 ✅） |
| gitee/main | `62532a7`（保持 G3 隔离，符合战略）|
| tag 推送 | **未推送** v0.2.0-beta.2（internal preview，符合 PM 指令） |
| Safety HARD GATE | 0 secret 进 stage / 0 `.env*` / 0 `.smoke-*` |
| typecheck | 三个 workspace 全 0 错 |
| runtime tests | **109/109 pass**（@codeflow/runtime@0.2.0-beta.2） |

### 1.2 QA-014 验收证据

| 维度 | 状态 |
|---|---|
| Safety HARD GATE 5/5 | ✅ |
| 版本号匹配 | `0.2.0-beta.2` ✅ |
| 109/109 单元测试 | ✅（含新 TS-MODEL-1~5 / TS-RUN-1~2 / TS-6.12/13/14）|
| A-07 banner WARNING 路径（no model）| ✅ 实测 |
| A-07 banner with model 路径 | ❌ BLOCKED by **BUG-SDK-007** |
| A-08 / A-09 / A-10 smoke | ❌ BLOCKED by **BUG-SDK-007** |
| 4 BUG closed 判定（单元强证）| ✅ **CLOSED**（TASK-014 §六 §七 已授权 unit 强证 sign-off） |

### 1.3 4 BUG 正式 closed sign-off

| BUG | MT | 实证 | QA 判定 |
|---|---|---|---|
| **BUG-SDK-001** | MT-1 defaultModel wire-through | TS-MODEL-1~5 + banner WARNING 实测 | **CLOSED** |
| **BUG-SDK-002** | MT-2 `local: { force: true }` 路径 | TS-RUN-1~2 逐行验证 | **CLOSED** |
| **BUG-SDK-003** | MT-3 `.env.example` `auto` → `default` | WARNING 路径实测 + `.env.example` 值确认 | **CLOSED** |
| **BUG-SDK-004** | H4 `extractText()` SDK content[] 解析 | TS-6.12/13/14 全通 | **CLOSED** |

→ **v0.2.0-beta.2 单元层 ship-ready；smoke 层 ship-NOT-ready（依赖 BUG-SDK-007 修复后补跑）**。

### 1.4 v0.2 sprint 0 5/8-5/11 累计交付

| 维度 | 数值 |
|---|---|
| commits | 9（含 5 个 fix + 4 个 docs archive） |
| tags | 4（alpha / beta / beta.1 / beta.2） |
| 单元测试基线 | 94 → 99 → 104 → 106 → **109**（净增 15） |
| BUG 累计修 | 4 / 4 closed |
| BUG 累计开 | 7（005/006/007 + 4 closed = 3 仍 open）|
| sprint 0 P1 完成度 | P1（真 SDK + ConfigLoader）= 100% 代码 + 80% smoke（BUG-007 阻断 20%）|

## 二、BUG-SDK-007 现状与处置

### 2.1 现象

ADMIN key + `CURSOR_DEFAULT_MODEL=任意值` → `Agent.create({ model: { id: X } })` 100% 拒绝：

```text
Error: Agent.create failed for agent_id="DEV-01":
  Cannot use this model: claude-sonnet-4 .
  Available models: default, composer-2, gpt-5.5, ..., claude-sonnet-4, ...
```

**错误信息悖论**：列出的「Available models」包含被拒绝的 `claude-sonnet-4` 和 `default` 本身 → 错误信息误导，真因是 ACL 不在白名单。

### 2.2 PM 推断的根因

Cursor 后端按 API key 订阅级别对「allow programmatic `model` field on `Agent.create()`」做 ACL 控制：
- DEV-13 自测 key（DEV 个人 key）= ACL ON → success
- ADMIN key（订阅级别可能不同）= ACL OFF → fail
- 解决方案：**`Agent.create()` 不传 model**（QA 推荐方向 A），仅在 `agent.send()` 传

### 2.3 PM 自决派单 TASK-20260511-001-PM-to-DEV

- 优先级：P0（不修则 ADMIN 设置 `CURSOR_DEFAULT_MODEL` 就 crash，等于试用 0 启动）
- 出厂版本：`v0.2.0-beta.3`（MT-5 single hotfix）
- 工期 SLA：90-110 min
- 修复方向：DEV 自选 A/B/C，PM 推荐 A
- 不上交 ADMIN 拍板：本 hotfix 是 sprint 0 P1 「真 SDK 跑通」目标的延续，与 MT-1/2/3/4 同性质，符合 PM 自约束第 5 条「常规推荐自决」

### 2.4 是否反馈 Cursor 团队

- 待 DEV-15 完工后判定：
  - 若证实是 key ACL（业务逻辑差异）→ 无需反馈
  - 若证实是 SDK 行为缺陷（错误信息误导用户）→ DEV 起草 issue，PM 转给 Cursor 团队

**符合 PM 自约束第 7 条**：BUG-SDK-007 是首例 SDK driver 行为问题，单点不构成「涌现稳定模式」，**不主动反馈** fcop / Cursor；DEV 实证后视情况决定。

## 三、ADMIN 双战略指令立项 Charter 第 5 条 + 自约束 6/7

### 3.1 5/11 09:35 ADMIN 战略指令一

> codeflow 一定是基于 FCoP 协议的，其实就是协议的具体应用；不需要自创的；如果有新的需求，向 FCoP 提，然后 FCoP 去解决。

### 3.2 5/11 09:37 ADMIN 战略指令二

> 既然 FCoP 未来要 AI OS，codeflow 只能是在 FCoP 协议基础上去做，当然，也许涌现的，可以补充 FCoP 协议。

### 3.3 立项为 Charter 第 5 条（与 1-4 同级）

**Charter 5 — CodeFlow 是 FCoP AI OS 上的具体应用 — 永不重发明，但允许涌现**

- 5.1 CodeFlow 一定基于 FCoP 协议，是协议在 **Cursor SDK + Mobile** 场景的具体应用
- 5.2 永不自造 fcop 已有的轮子（task / review / registry / schemas / file ops 等 30 工具 + 14 资源覆盖范围）
- 5.3 类比定位：**FCoP : CodeFlow ≈ POSIX : Vim ≈ Windows : VSCode**
- 5.4 涌现优先：协议侧需求**必须自然涌现自落地实战**，不允许 PM 主动「为 fcop 设计需求」
- 5.5 反哺机制：经过多次（建议 ≥3 次）独立涌现 + 形成稳定模式后，PM 才把它**作为现象**（不带方案）反馈给 ADMIN，由 ADMIN 决定是否反馈 fcop 维护者

### 3.4 配套 PM 自约束第 6 条（生效）

> 任何「与上游对齐」类 sprint 启动前，PM **必须**先实际跑过上游实现的核心命令（`pip install` → `fcop_report` → `write_task` → `write_review`），并写出「上游实际能力 vs CodeFlow 自实现」差异化对照表，作为 sprint 启动的必要前置条件。绕过此步导致的重做工期 / 报废投资，由 PM 自负责任。

### 3.5 配套 PM 自约束第 7 条（生效）

> PM **不主动设计**协议侧需求。CodeFlow 落地过程中遇到的「卡点」，**第一反应**是「绕一下」用 fcop 已有能力凑合；**第二反应**是「内部消化」（codeflow-shell 自己封装）；只有当**同一类卡点独立涌现 ≥3 次且形成稳定模式**时，才作为**现象**（不带方案）报给 ADMIN。

### 3.6 PM 错误自披露（第 3 次）

PM 5/9-5/11 期间一直把 fcop 视为「**协议 only**」（YAML schema + ADR），未察觉 fcop-mcp v1.1.0 已是「**协议 + 30 工具 + 14 资源 + 8 schemas 完整运行时栈**」。这是 PM **战略级判断盲点**，导致 v0.1 sprint S1-S6 部分代码在重新发明 fcop 已有能力。**根因**：未在 5/9 issue #2 reply 前实际 `pip install fcop fcop-mcp` 跑一遍 + 调 `fcop_report` 看返回。

**自我修正**：第 6 条自约束生效（上游对齐 sprint 前必须先跑）+ 之前主动起草的 REQ-001/002/003（PM 越位为 fcop 设计需求）全部撤回到内部观察日志。

## 四、v0.1 投资处置 & P4 sprint 完全重做

### 4.1 v0.1 代码处置矩阵

| 模块 | 处置 | 理由 |
|---|---|---|
| `codeflow-shell/`（Node 启动器 + ConfigLoader 6-tier） | ✅ 保留 + 强化 | fcop 是 Python，无 Node 启动器 |
| `AgentSdkAdapter`（@cursor/sdk 驱动） | ✅ 保留 + 强化 | fcop 不驱动 LLM/SDK |
| `RuntimeBootstrap` + `atomic-write` retry | ✅ 保留 | fcop Project API 无 Windows EPERM retry |
| `SessionManager` | ✅ 保留 | fcop 无 SDK session 概念 |
| `relay-bridge.ts`（待 P3）+ PWA | ✅ 保留 + 强化 | fcop 无 Mobile 入口 |
| runtime 109 测试基线 | ✅ 保留 | 覆盖 SDK driver 路径 |
| `TaskDispatcher` | 🔄 改造 | 改调 fcop `list_tasks` / `read_task` / `archive_task` |
| `ReviewEngine` | 🔄 改造 | 改调 fcop `write_review` + `mark_human_approved` |
| `NeedsHumanGate` | 🔄 改造 | 直接用 fcop `decision="needs_human"` |
| `AgentRegistry`（团队/角色） | 🔄 改造 | 改调 fcop `init_project` / `get_team_status` |
| `PersistentStore` (`agents.json`) | 🔄 改造 | 用 `fcop/fcop.json` + Project API |
| v0.1 自有 5 schemas（TS types） | 🗑️ 删除 | 运行时读 `fcop://spec` + 8 fcop schemas |
| `docs/agents/tasks/` 目录 | 🚚 迁移 | 用 `fcop migrate-workspace` CLI 迁到 `fcop/tasks/` |

**统计**：保留 ~60% / 改造 ~30% / 删除 ~10%。v0.1.0-rc.1 + v0.2.0-beta.x 投资中 **60% 保留并强化**，**40% 改造或弃用**。

### 4.2 P4 sprint 内容完全重做

| | 原 P4（5/10 拍）| **新 P4（Charter 5 后）** |
|---|---|---|
| 目标 | 自有 5 schemas → 8 schemas + risk_level + human_approval + skill.tools[] | 删除自有 schemas，集成 fcop library 替换 runtime 文件层 |
| 工作 | TS schema 重写 | Node ↔ Python 桥方案选型（D7）+ fcop library 子进程封装 + runtime 文件层替换 + 集成测试 |
| 测试 | 109 → 130 | 109 → 80-90（删除自有 task/review/registry tests）+ 30 fcop bridge tests |
| 工期 | +0.5d → 5/18 EOD | **+4-6d → 5/22-5/24 EOD** |
| v1.0 公开发布影响 | 5/27 不变 | **5/29-6/2**（仍早于原 6/10 基线 8-11 天）|

### 4.3 新增决策点（PM 调研后上交 ADMIN 拍板）

| ID | 项 | PM 倾向 | 上交时点 |
|---|---|---|---|
| D7 | Node ↔ Python 桥方案 | a) `child_process spawn`（推荐）/ b) MCP stdio 调 fcop-mcp / c) Pyodide / d) `python-shell` npm | 5/13 EOD 前 |
| D8 | PWA Mobile 与 fcop 写关系 | PWA 通过 relay → CodeFlow gateway → fcop API（单 source-of-write）| P3 启动前 |
| D9 | codeflow-pwa Dependabot 12 vulns（8 high）| 战略转向后评估 PWA 是否要重写在 fcop 上 → 决定是修 deps 还是重写 | 5/15 前 |

## 五、CodeFlow 公开发布定位调整

| 维度 | 之前 | **现在** |
|---|---|---|
| 自我介绍 | AI Operating Runtime | **FCoP AI OS 上的第一个 Cursor + Mobile first-party application** |
| 类比 | 平台 / runtime | **POSIX : Vim** / **Windows : VSCode** 的 Vim/VSCode 位置 |
| issue #2 reply 草稿口吻 | 「我们做了 application of fcop」 | 「我们在用 fcop@1.x 跑 Cursor SDK + Mobile 这块场景，跑通了」（克制，不主动设计需求） |
| 与 fcop 维护者关系 | PM 维护「上游需求清单」 | PM 维护**内部涌现日志**（只看，不主动外发）|

## 六、当前推进队列

| 任务 | 状态 | 派给 | 预期完工 |
|---|---|---|---|
| **TASK-20260511-001-PM-to-DEV**（BUG-SDK-007 hotfix → v0.2.0-beta.3） | **新派** | DEV | 11:30-12:00 (UTC+8) |
| **TASK-20260511-002-PM-to-OPS**（repo 根 .gitignore + clean 7 stale dirs） | **新派**（可与 DEV-001 并行） | OPS | 10:10 (UTC+8) |
| **TASK-20260511-XXX-PM-to-OPS**（v0.2.0-beta.3 commit + tag）| 待 DEV-001 完工后派 | OPS | DEV+15min |
| **TASK-20260511-XXX-PM-to-QA**（v0.2.0-beta.3 完整 smoke 验收）| 待 OPS commit 后派 | QA | OPS+35min |
| **TASK-20260511-XXX-PM-to-DEV**（P3 relay-bridge MVP 正式单）| 待 v0.2.0-beta.3 + smoke 全绿后派 | DEV | 5/12-5/14 |
| **TASK-20260511-XXX-PM-to-DEV**（P4 fcop library 集成调研）| 待 ADMIN 拍 D7 后派 | DEV | 5/13-5/14 |

## 七、ADMIN 关键动作

1. **唤醒 DEV cursor session 打「巡检 开工」** → DEV 接 TASK-001（BUG-SDK-007 hotfix）
2. **唤醒 OPS cursor session 打「巡检 开工」** → OPS 接 TASK-002（gitignore + clean，与 DEV 并行）
3. **（可选 / 不阻塞）回复 D7 / D8 / D9 三个决策点的初步倾向**，PM 据此调研

## 八、PM 自约束执行审计

| 决策 | 性质 | 处置 |
|---|---|---|
| 接受 OPS-014 + QA-014 完工结果 | 常规执行 | ✅ 自决 |
| 派 TASK-001 BUG-SDK-007 hotfix | sprint 0 P1 延续 | ✅ 自决（自约束 5）|
| 派 TASK-002 hygiene fix | 常规推荐 | ✅ 自决（自约束 5）|
| Charter 5 + 自约束 6/7 入档 | 战略级（但 ADMIN 已主动指令，PM 仅执行）| ✅ 执行（非「上交」）|
| PM 第 3 次错误自披露 | 错误自披露 | ✅ 主动公开（自约束 5）|
| v0.1 投资 60% 保留 / 40% 改造决定 | 重大变更 | ⚠️ **上交 ADMIN 拍板**（本 REPORT § 4.1）|
| P4 sprint 完全重做 | 重大变更 | ⚠️ **上交 ADMIN 拍板**（本 REPORT § 4.2）|
| D7 / D8 / D9 三决策点 | 重大变更 | ⚠️ **上交 ADMIN 拍板**（PM 调研后正式请示）|
| v1.0 公开发布从 5/27 → 5/29-6/2 | 重大变更（时间）| ⚠️ **上交 ADMIN 拍板**（本 REPORT § 5）|

**总计**：6 项自决 + 4 项上交 ADMIN（含 1 项已 ADMIN 主动指令 = 仅执行）。

## 九、一句话送 ADMIN

> v0.2.0-beta.2 已 ship（4 BUG closed），BUG-SDK-007 新发现 PM 已派 DEV 干 v0.2.0-beta.3，**Charter 5（CodeFlow = FCoP 应用）+ 自约束 6/7 入档生效**，v1.0 公开发布 5/29-6/2（仍早于原 6/10 基线 8-11 天）。
>
> 你 1 件事：**DEV + OPS cursor session 各打巡检 开工**，DEV-001 + OPS-002 并行跑，~30 min 后看 DEV-001 状态决定后续 OPS commit。

---

PM-01
2026-05-11 10:00 (UTC+8)
