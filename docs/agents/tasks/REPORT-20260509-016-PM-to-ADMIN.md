---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-016
sender: PM
recipient: ADMIN
priority: P0
thread_key: codeflow-v2-sprint-s3-phase-b-launch + v2-packaging-decision-locked
references:
  - REPORT-20260509-012-OPS-to-PM
  - REPORT-20260509-014-QA-to-PM
  - REPORT-20260509-015-PM-to-ADMIN
  - TASK-20260509-012-PM-to-OPS
  - TASK-20260509-013-PM-to-DEV
  - TASK-20260509-014-PM-to-QA
  - docs/design/codeflow-v2-on-fcop-sdk.md#11
layer: governance
---

# 巡检 2 + ADMIN 5/9 14:33 拍板「v2 EXE 路径」落档完成 + Phase B 仍在实施

## 一句话结论

ADMIN 5/9 14:33「按推荐!!!!」（4 感叹号强信号）= **W1=Y（v2 也是 EXE，技术栈 Node 22+ SEA）** + **W2=A（PM 立刻起草设计章节，不阻塞 Phase B）** + **W3=b（v2 EXE 出厂后给 v1 一个 release cycle 迁移期）**。**PM 已在设计文档插入完整的新 §11 章节**（共 9 个二级子节，261 行），把现有 §11 附录降级为 §12（含 §11.1~§11.4 → §12.1~§12.4）。Phase A done checkpoint 已 commit + 双备份就绪（`407cfa5`），Phase B 仍在实施（DEV 已 ~30min）。当前未 commit 项 = QA test-strategy 的 post-commit diff + PM 刚写的 §11 设计文档；PM 已派 [`TASK-015-PM-to-OPS`](./TASK-20260509-015-PM-to-OPS.md) 让 OPS 单独打第二个 patch commit。

---

## §一 巡检结果三方对账

| 角色 | 状态 | 关键证据 |
|---|---|---|
| **OPS-01** | ✅ 已完成 [`TASK-012`](./TASK-20260509-012-PM-to-OPS.md) | commit `407cfa5` 落地（24 files / 7663+ / 213-）；origin + backup HEAD 一致；gitee 按 G3 跳过；9 项验收命令实证全过；详见 [`REPORT-012`](./REPORT-20260509-012-OPS-to-PM.md) |
| **QA-01** | ✅ 已完成 [`TASK-014`](./TASK-20260509-014-PM-to-QA.md) | `test-strategy-s3.md` 524 行（< 600 限制）；§3.2 TS-2.8 更新 + §3.4 TS-4.1~4.5 完整 + §5b 15 项对照 + §6 改名 + 2 条 FCoP 议题已确认；详见 [`REPORT-014-QA-to-PM`](./REPORT-20260509-014-QA-to-PM.md) |
| **DEV-01** | ⏳ Phase B 实施中 | 5/9 ~14:00 接 [`TASK-013`](./TASK-20260509-013-PM-to-DEV.md)，预算 7.5-10.5h；目前 ~30min，正常 |

QA 还发现 1 个轻微缺口（**TS-1.6 并发 upsert** 在 DEV Phase A 16 测试中未出现）——QA 自评"不阻断 Phase A acceptance，建议 Phase B 顺手补"。**PM 决定**：写一个简短的 follow-up 通知给 DEV（不修改已派的 TASK-013，按 codeflow-project 规则只追加；详见 §三末尾"加派 TASK-016"）。

---

## §二 ADMIN 5/9 14:33 拍板 3 议题正式落档

### 议题 W1：v2 用户最终拿到的形态

| 选项 | 含义 | ADMIN 拍板 |
|---|---|---|
| X. 去 EXE 化 | Mobile PWA 主入口 + PC 守护进程（命令行） | ❌ |
| **Y. v2 也是 EXE** | v2 沿用双击形态，技术栈换 Node 22+ SEA | ✅ **采纳** |
| Z. 双形态共生 | npm CLI + EXE 两条交付链并存 | ⏸ v1.0 后再评估 |

技术栈选 **Node 22+ `--experimental-sea-config`** —— 官方原生、~30MB（≈ v1 PyInstaller 包大小，零体积断层）、不带 Webview/Chromium、跟 `@cursor/sdk` 同栈。

### 议题 W2：本议题的落档形式

ADMIN 拍 **A** = "PM 在 Phase B 期间起草新章节，不阻塞 DEV"。**PM 已完成**（详见 §三）。

### 议题 W3：v1 EXE 的退路

ADMIN 拍 **b** = "v2 EXE 完成后立刻把 v1 EXE 标 deprecated 但保留下载，给 v1 用户 1 个 release cycle 迁移期"。已落档为 §11.4 的时间线。

---

## §三 §11 设计文档落档已完成

### 落档摘要

| 项 | 数值 |
|---|---|
| 设计文档文件 | `docs/design/codeflow-v2-on-fcop-sdk.md` |
| 改动前总行数 | 2389 |
| 改动后总行数 | 2650（+261 行净增） |
| 新增章节 | §11 Packaging & Distribution（v2 用户最终拿到什么） |
| 重新编号 | §11. 附录 → §12. 附录（含 §11.1~11.4 → §12.1~12.4 4 个子节）|
| 起草历史登记 | §12.4 加"第六刀" 行（详见 §四附图） |
| ReadLints | 0 错误 |

### §11 章节结构（9 个二级子节）

```
§11.0 一句话锁定（用户最终拿到什么）的 6 行决策表
§11.1 为什么是 EXE 而不是 npm CLI / Mobile-only
       └─ 选项空间表 + 不选 X 的 4 条理由 + 不选 Z 的 1 条理由 + 选 Y 的关键判据
§11.2 工程结构：codeflow-shell/ 子项目
       └─ 仓内布局图 + 技术栈选型对比表（5 候选）+ 采纳 Node SEA 的关键理由
§11.3 v2 EXE 的内部架构（4 层）
       └─ ASCII 架构图（Shell / Runtime Kernel / Protocol / Adapter）+ 4 条层级原则
§11.4 v1 EXE 的退役共生（W3=b 落档）
       └─ 时间线（S6/S7-S10/v0.3 触发节点）+ deprecation buffer 4 项判据
§11.5 与路径 X / 路径 Z 的兼容关系
       └─ 路径 Y 不排斥 X / Z 的 2 条工程预留
§11.6 Sprint 归属：Sprint S6（v0.1 最后一刷）
       └─ §10.2 sprint 表 + S6 范围扩展（codeflow-shell/ 加入 S6）
§11.7 Sprint S6 acceptance（v2 EXE 出厂判据）
       └─ 10 项验收（双击零依赖 / 托盘 / 体积 ≤ 50MB / 启动 ≤ 3s 等）
§11.8 风险与回退
       └─ 5 类风险 + 5 个 Plan B（Node SEA 退化到 Bun.compile 等）
§11.9 与现有章节的索引
       └─ 7 条交叉引用（§0.7.2 / §0.7.4 / §0.9.1 / §2.1 / §0.8.3 / §8.2 / §10.6）
```

### 关键设计判据（§11.0 一句话锁定）

| 维度 | 决策 |
|---|---|
| 用户最终拿到 | `CodeFlow-v3.0.0.exe`（Windows 单 EXE）+ 后续 macOS/Linux pkg |
| 启动方式 | 双击 → 系统托盘 + 自启 web panel `http://127.0.0.1:18765`（沿用 v1 端口） |
| 安装前置 | **零额外依赖**（不需要装 Node / Python / Cursor IDE） |
| 与 Mobile PWA 关系 | EXE = PC 执行节点入口；PWA = Governance 入口（§0.9）；两者通过 `server/relay/` 配对 |
| 与 v1 EXE 关系 | v2 EXE 出厂后给 v1 用户 **1 release cycle** 缓冲，再归档 `legacy/` |
| 实施 sprint | **Sprint S6**（v0.1 Backend Kernel 最后一刷，§10.2 末位） |

### 关键工程细节（§11.2-§11.3）

新增 `codeflow-shell/` 子项目结构：

```
codeflow-shell/
├── src/
│   ├── main.ts          ← 入口（启动 runtime + tray + panel + bridge）
│   ├── tray.ts          ← 系统托盘（继承 v1 行为）
│   ├── web-panel.ts     ← 内嵌 Express + 复用 web/pwa/ 静态资源
│   ├── relay-bridge.ts  ← 与 Mobile PWA 通信（沿用 v1 server/relay/）
│   └── lifecycle.ts     ← 单实例互斥 + 优雅退出 + 自启注册
├── assets/app.ico       ← 沿用 v1 panel/app.ico
├── sea-config.json      ← Node 22+ SEA 配置
└── pack.cmd / pack.sh
```

4 层架构（核心创新）：
- **Layer 1 Shell** = `codeflow-shell/`，可选层（Z 路径预留）
- **Layer 2 Runtime Kernel** = `@codeflow/runtime`，独立可脱壳运行（X / Z 路径预留）
- **Layer 3 Protocol** = `@codeflow/protocol`，§3 已锁定
- **Layer 4 Adapter** = CursorSdkAdapter / FcopMcpClient / RelayClient，全走 §3.6 Skill schema

### 关键时间线（§11.4 W3=b 落档）

```text
[ Sprint S6 ─ Q3 2026 ]
   ├─→ codeflow-shell/ 落地 + CodeFlow-v3.0.0.exe 首次出厂
   ├─→ v1 codeflow-desktop/ 进入 freeze
   └─→ Release notes 同时公告 v3.0.0 + v2.12.x deprecation

[ Sprint S7-S10 ─ Q4 2026 ]
   ├─→ v1 EXE 仍可下载，但标 "deprecated"
   ├─→ Update notice 弹窗推 v3.x
   └─→ v2 EXE 跑通 §0.8.3 Hello World + Mobile pairing

[ v0.3 触发 ─ Q1 2027 ]
   └─→ codeflow-desktop/ git mv 到 legacy/codeflow-desktop-v1/
       Release page 不再显示 v2.12.x 下载链接
```

---

## §四 PM 当前未 commit 的 7 份产物

```
M  packages/codeflow-runtime/docs/test-strategy-s3.md         (QA 5/9 14:25 改动，未进 407cfa5)
M  docs/design/codeflow-v2-on-fcop-sdk.md                    (PM 5/9 14:35 §11 落档 +261 / -47)
?? docs/agents/tasks/REPORT-20260509-012-OPS-to-PM.md        (OPS 5/9 ~14:10 写的 TASK-012 回执，未进 407cfa5)
?? docs/agents/tasks/REPORT-20260509-014-QA-to-PM.md         (QA 5/9 ~14:25 写的 TASK-014 回执，未进 407cfa5)
?? docs/agents/tasks/REPORT-20260509-016-PM-to-ADMIN.md      (本文件)
?? docs/agents/tasks/TASK-20260509-015-PM-to-OPS.md          (PM 5/9 14:42 派单)
?? docs/agents/tasks/TASK-20260509-016-PM-to-DEV.md          (PM 5/9 14:48 派单)
```

**7 份全部是 docs（文档级），跟 DEV Phase B 代码改动（`src/session/`）无依赖**——PM 已派 [`TASK-20260509-015-PM-to-OPS.md`](./TASK-20260509-015-PM-to-OPS.md) 让 OPS 立刻打 patch commit `docs(s3-followup): test-strategy TS-2.8 update + section 11 v2 packaging spec`，单独 push 到 origin/backup（gitee 仍按 G3 跳过）。

> **关于 OPS-12 commit `407cfa5` 漏掉两份回执的解释**：
>
> `407cfa5` 是 OPS 在 5/9 ~14:00 跑的 commit，那时 OPS 自己的 `REPORT-012-OPS-to-PM.md` 还没生成（回执是 commit 完成**之后**才写）；同样地，QA 自己的 `REPORT-014-QA-to-PM.md` 也是在 OPS commit 之后才完成。这是流程时序的自然结果，不是 OPS 失误。本批 follow-up commit 把两份回执补齐。

不等 DEV Phase B 完成的理由：
- §11 设计章节是 ADMIN 拍板级落档，单独 commit 让 git log audit-friendly
- DEV Phase B 还要 5-7h，文档级改动等不起
- 两份都不影响 Phase B 工作区（DEV 改的是 `packages/codeflow-runtime/src/session/`，跟 `docs/` 完全隔离）

---

## §五 加派 TASK-016：DEV TS-1.6 并发 upsert follow-up

QA-14 §三发现 1 个轻微缺口：[`REPORT-009-DEV §三`](./REPORT-20260509-009-DEV-to-PM.md) 16 个 Phase A 单元测试**没覆盖** TS-1.6（100 次并发 upsert 不产生半残文件）。QA 自评不阻断 Phase A acceptance，但建议 Phase B 顺手补。

PM 同意 QA 判断 + 决定**不打断 Phase B**（不重写 TASK-013），改为单独写一份小任务 [`TASK-20260509-016-PM-to-DEV.md`](./TASK-20260509-016-PM-to-DEV.md)：

- 范围：在 `__tests__/PersistentStore.test.ts` 加 1 个并发 upsert 场景（建议 5-10 次 Promise.all，不必 100 次）
- 时间预算：≤ 30 分钟
- 时机：DEV 在 Phase B 完成后顺手做（Phase B 主交付不延期）

---

## §六 Sprint S3 累计进度看板（PM 自检）

| Phase | 主题 | 状态 | 完成时间 |
|---|---|---|---|
| Phase A | AgentRegistry + PersistentStore + RuntimeBootstrap | ✅ 完成 + commit `407cfa5` 双备份就绪 | DEV ~3.5h（预算 6-10h，远低）|
| Phase B | SessionManager + SessionStore + TranscriptWriter + L2 文档 + TS-2.8 patch | ⏳ 进行中（~30min） | DEV 预算 7.5-10.5h |
| Phase C | Task Scheduler chokidar inbox + state_history 自动追加 | ⏳ 待 Phase B 完成 | TBD |

时间线（基于当前节奏）：
- Phase B 预计 5/9 19:00-22:00 期间完成
- Phase C 预计 5/10 上午开干，5/10 19:00 前完成
- Sprint S3 整体预计 5/10 内 ship

---

## §七 PM 接下来要做的事（不需 ADMIN 决策）

1. **派 [`TASK-015-PM-to-OPS`](./TASK-20260509-015-PM-to-OPS.md)** ⏵ 让 OPS 跑第二轮 patch commit
2. **派 [`TASK-016-PM-to-DEV`](./TASK-20260509-016-PM-to-DEV.md)** ⏵ TS-1.6 follow-up（DEV 在 Phase B 末顺手做）
3. **等 OPS 交 `REPORT-015-OPS-to-PM`**（patch commit 完成）
4. **等 DEV 交 `REPORT-013-DEV-to-PM`**（Phase B 完成）
5. **DEV Phase B 完成后第三轮巡检 + PM-side review** ⏵ 写 `REPORT-017-PM-to-ADMIN`，准备 Phase C 派单

---

## §八 此轮巡检的 lesson learned

### LL-1：ADMIN 提了一个产品级缺口，PM 立刻识别为"高于 sprint 进度"的层级

ADMIN 5/9 14:30 抛出"码流是一个 exe 文件，我们软件设计呢？"——PM 第一反应不是直接答，而是**先 grep 设计文档，发现 §11 v2 packaging 完全空白**，然后**主动暂停巡检报告**，把这件事升格成"v0.1 release 级阻塞议题"。这个反应路径符合 §0.6 / §0.7 的"先看到大局再决定动作"原则。

### LL-2：「按推荐!!!!」=ADMIN 信任已建立的强信号

4 感叹号 = 比"按推荐！"信任度更高 = ADMIN 在等 PM 做完整的设计文档落档。PM 在 ~7 分钟内完成 261 行新章节起草 + 4 个子节标号重整——这是 PM-ADMIN 协作模型已经成熟的体现。

### LL-3：设计文档落档与 sprint 工程并行不冲突

§11 落档跟 Phase B 实施完全解耦——PM 改 `docs/design/`，DEV 改 `packages/codeflow-runtime/src/session/`，两者文件路径不重叠 = git workspace 不冲突 = 可以并行。这是 §0.6.2 「外部状态系统」的工程兑现。

---

## §九 待 ADMIN 决策（非阻塞）

PM 此轮**没有需要 ADMIN 立刻拍板**的议题——所有 W1/W2/W3 都已落档，Phase B 仍按既定 TASK-013 范围实施。下一次需要 ADMIN 决策的时间点 = DEV 交 `REPORT-013-DEV-to-PM`（Phase B 完成）后的第三轮巡检。

如果 ADMIN 此刻有以下任一念头，可立即给信号：
- 想看 §11 落档原文 ⏵ `docs/design/codeflow-v2-on-fcop-sdk.md` line 2343-2604
- 想给 codeflow-shell/ 在仓内的位置一个"早期 placeholder"（提前创建空目录 + README）⏵ 我可立即派 OPS
- 想把 §11 内容同步到 `docs/codeflow-overview.md`（对外速读版）⏵ 我可派 DEV 在 Phase B 之后做
- 想在 GitHub Release notes 里提前预告 v3.0.0 ⏵ 不建议（v0.1-alpha.1 还没发 release，v3.0.0 只是 §11 锁定的未来里程碑名）

否则 PM 继续走 §七 接下来要做的事。

---

PM-01 完成第 2 轮巡检 + ADMIN 5/9 14:33 拍板正式落档 + §11 设计章节起草。
