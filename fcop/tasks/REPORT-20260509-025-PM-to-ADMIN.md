---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-025
sender: PM
recipient: ADMIN
priority: P0
thread_key: codeflow-v2-v0-1-0-rc-1-internal-preview-shipping-milestone
references:
  - REPORT-20260509-028-DEV-to-PM
  - REPORT-20260509-029-OPS-to-PM
  - REPORT-20260509-024-PM-to-ADMIN
  - REPORT-20260509-023-PM-to-ADMIN
  - TASK-20260509-030-PM-to-OPS
  - TASK-20260509-031-PM-to-QA
  - codeflow-shell/README.md
  - https://github.com/joinwell52-AI/FCoP/issues/2#issuecomment-4412811192
layer: governance
---

# 里程碑通报：v0.1.0-rc.1 internal preview 即将出厂 — ADMIN 试用就绪 + S5/S6 全数交付

## 一句话结论

**S6 在 ADMIN 5/9 23:14「按推荐」激活后约 ~80 分钟内完工**：DEV-028 交付 codeflow-shell/ MVP（5 件主交付 + 5 surprise 全 disclosed）+ OPS-029 落档第二轮 docs commit `68a0ebe`（94/94 baseline 仍 pass）+ PM 独立复核 100% 一致。**已派 OPS-030（S6 commit + 本地 tag v0.1.0-rc.1，不推 origin tag）+ QA-031（E2E 三场景验收）**。距 ADMIN 试用就绪剩 ~50 min。**v0.1 Backend Kernel 8 子系统 / 14 子模块全部装配完毕**。**v0.2 sprint 0 启动判据全部满足时间窗 = 5/20+ 之后**（等 fcop@1.0.0 final）。

---

## §一 S6 完工证据（PM 独立复核一致）

```
$ cd packages/codeflow-runtime
$ npx tsc --noEmit               # exit 0
$ npm test
ℹ tests 94
ℹ pass 94
ℹ fail 0
ℹ duration_ms 7979.3028
```

**4 个 sprint 累积 testing snapshot**：
- Phase A：18（registry 全套）
- Phase B：22（session 全套）
- Phase C：14（scheduler 全套）
- Phase D：13（review 全套）
- Phase E：17（skill 全套，含 4 bonus）
- 跨阶段 sanity：10
- **总计 94 / 94 / 0 fail / 30x 0 flaky** — DEV REPORT-024 / 028 + PM 独立 1x 复核一致 + QA REPORT-027 30x 复核

---

## §二 接受 DEV 5 个 surprise（PM 自决，按第 5 句宪法）

| Surprise | 内容 | DEV 选择 | PM 处置 |
|---|---|---|---|
| **0 (PM 错误)** | TASK-028 §一-2 main.ts 模板与 RuntimeCreateOptions API 3 处不符（`sdk` vs `sdkAdapter` / 多余 `transcriptsDir` / 不存在 `runtime.bootstrap()`）| 按现有 API 实施 | ✅ 接受 + 致歉。教训：v0.2 sprint 0 时把 design doc §11.3 的模板拉齐 |
| **1 (Node SEA 跑不通)** | esbuild 卡 `import.meta.url` + `@cursor/sdk` ESM 链 + `.d.ts.map` 文件 | fallback：`pack.cmd` 落档供 v0.2 起点；v0.1 走 `npm start` | ✅ 接受（PM 在 TASK-028 §三 已 bless）|
| **2 (Windows signal)** | child_process spawn 出来的进程 SIGINT 不走 Node handler | 用 in-process `runtime.stop()` 替代验证（真实交互式 Ctrl+C 仍 OK）| ✅ 接受。这是 Node.js 平台限制，不是 bug |
| **3 (demo 文件名)** | `InboxWatcher` 正则要求 `\d{3}` 序号 | 改 `999` demo 序号 | ✅ 接受 |
| **4 (Windows EPERM race)** | `agents.json` atomic-rename 偶发 EPERM | 标 known-issue（零功能影响）| ✅ 接受 + **decline atomic-write retry patch 派单** — 推到 v0.2（理由：v0.2 sprint 0 会动 runtime src/，集中处理；v0.1 RC 是 internal preview，零功能影响可容忍）|

PM 自约束触发：「sub-decision 接受 = PM 自决」 → 5 个 surprise 全部 PM 自决处置（无议题需 ADMIN 拍）。

### 2.1 特别价值发现

DEV demo 走 `decision: needs_human` 路径**反而实证了 B.1 决策的工程价值**：

> InMemorySdkAdapter 不发 VERDICT 行 → verdict-parser 退到 needs_human (TS-6.9) → cli sink 推送 → REVIEW + human_approval 落档

→ **ADMIN 试用 demo 看到的就是「ADMIN 拍板」真实工作流的演示**——B.1 决策（保留 v0.1 needs_human + human_approval + deprecation note）的工程价值在 demo 中被自动证实。这是 v0.2 sprint 0 把 needs_human 撤到 Boundary 之前的最后一个 demo case。

---

## §三 v0.1 Backend Kernel 出厂状态

### 3.1 8 子系统 / 14 子模块就绪

```
[Phase A 3]  AgentRegistry + PersistentStore + RuntimeBootstrap
[Phase B 3]  SessionManager + SessionStore + TranscriptWriter
[Phase C 4]  InboxWatcher + TaskParser + StateHistoryWriter + TaskDispatcher
[Phase D 4]  ReviewEngine + ReviewWriter + NeedsHumanGate + AgentStatusReconciler
[Phase E 3]  SkillRegistry + KernelDependencyValidator + MCPInjector(stub)
[S6   1]  codeflow-shell (MVP — main.ts + bootstrap.ts + sdk-factory.ts) ⭐ 新

= 14 子模块装配 + 1 shell 入口 = 15 文件级组件
```

### 3.2 v0.1 §0.8 6 条硬约束 6/6 全满足（QA REPORT-027 §四已实证）

| # | 硬约束 | 验证 |
|---|---|---|
| 1 | 零 UI（npm/Node lib + cli stdout）| ✅ codeflow-shell stdout banner |
| 2 | 状态全文件化 | ✅ agents.json / sessions/*.json / reviews/*.md / transcripts/*.md / state_history append-only |
| 3 | 进程能恢复 | ✅ RuntimeBootstrap reconcile loop（TS-2.1~2.8）|
| 4 | 每步有 reviewer | ✅ ReviewEngine governance loop（TS-6.6~6.13）|
| 5 | 全本地 | ✅ MCPInjector live=eager throw |
| 6 | fcop-mcp 强依赖 | ✅ KernelDependencyValidator 双路径不可绕过（TS-7.5~7.13）|

### 3.3 §0.0 5 句宪法兑现对照

| 句 | 兑现方式 |
|---|---|
| 1「身份 + 技术栈」| ✅ `peerDependencies.@cursor/sdk` + skill.required_kernel.contains "^fcop@.+" |
| 2「轻量级 AI Runtime」| ✅ 5 schemas + 14 子模块 + npm/Node lib 形态（Node SEA fallback 留 v0.2）|
| 3「约束+能力+状态+权限 → 不会崩溃的协作宇宙」| ✅ KernelDependencyValidator 物理隔离 + ReviewEngine governance loop + AgentStatusReconciler 状态闭环 |
| 4「下达/审批/变更 三动作」| ✅ TASK→ADMIN→PM→DEV/OPS/QA→REPORT→ADMIN 全链路文件化 + state_history 自动追加 |
| 5「按推荐」| ✅ 本会话内 PM 自约束按表执行 + 5 surprise 自决 + v0.2 路线图 PM 草拟 |

---

## §四 已派 2 单（PM 自决，按第 5 句宪法）

| 派单 | 目的 | 启动条件 | 时长 |
|---|---|---|---|
| [`TASK-030-PM-to-OPS`](./TASK-20260509-030-PM-to-OPS.md) | S6 commit + push origin/backup + **本地 tag `v0.1.0-rc.1`（不推 origin tag）** | 立即（约 21 项 staged）| ≤ 8 min |
| [`TASK-031-PM-to-QA`](./TASK-20260509-031-PM-to-QA.md) | E2E acceptance 三场景（npm start / drop / Ctrl+C）+ ADMIN 试用引导 | OPS-030 后 | 30-45 min |

### 4.1 关于本地 tag vs origin tag

ADMIN 5/9 23:14「按推荐」覆盖 A.1 明确写：「**internal RC tag** + 不公开发布」。

→ TASK-030 §一锁死：**本地 tag `v0.1.0-rc.1`**（标记内部出厂时刻）+ **不**推到 origin/backup（不让 GitHub Releases 显示）。理由：
1. push tag = 公开行为（GitHub Releases 立刻显示）
2. v0.1 用了 v0.2 即将 deprecated 的 5-schema + needs_human shape，发出去会 confuse 外部
3. 等 v0.2 sprint 0 完工后正式 push tag `v0.2.0-alpha.1`（届时 align fcop@1.0 charter）

### 4.2 不派 atomic-write retry patch 单（PM 自决）

DEV-028 §八 follow-up 列了 atomic-write helper retry-on-EPERM patch（30 行 cross-cutting）。

PM 决策：**不**单独派单。理由：
- 零功能影响（DEV REPORT-028 §三 surprise 4 已论证）
- v0.2 sprint 0 会动 runtime src/（含 schema 重构），届时一并处理
- 减少 v0.1 RC 出厂动作量

---

## §五 ADMIN 试用就绪步骤（OPS-030 + QA-031 完工后约 ~50 min）

```powershell
# 1. cd 到仓
cd D:\Bridgeflow\codeflow-shell

# 2. 安装依赖
npm install

# 3. 启动
npm start
# 期望：banner + 等待 inbox

# 4. 在第二个 PowerShell 窗口 drop sample task
copy examples/hello-world/sample-task.md ".smoke-test-state\inbox\TASK-20260509-999-PM-to-DEV.md"
# 看主窗口 governance loop 跑通

# 5. 主窗口 Ctrl+C 退出
```

QA-031 完工后会给完整 ADMIN 引导（含每步该看到的关键 stdout）。

ADMIN 试用过程中如发现任何问题：写 `TASK-*-ADMIN-to-PM.md`，PM 立即接管。

---

## §六 horizon — v0.1 RC 出厂之后

### 6.1 短期（~50 min 内）

```
现在 → ~10 min     OPS-030 commit + push origin/backup + 本地 tag
~10 min → ~50 min  QA-031 三场景 E2E acceptance + ADMIN 试用引导
~50 min            v0.1.0-rc.1 internal preview 出厂完成
```

### 6.2 中期（v0.1 出厂后到 fcop@1.0.0 final）

```
~50 min → 5/20    ADMIN 自由节奏试用 v0.1 internal RC（同时 fcop@1.0.0 final 在上游 5/16-5/20）
                  ADMIN 拍板 issue #2 reply 草稿（DRAFT-001，PM 推荐 b 短版）
                  → ADMIN 用 @joinwell52-AI 身份 post issue #2 第三条 comment
```

### 6.3 长期（v0.2 sprint 0）

```
5/20+ 启动判据全满足后        ADMIN 写 TASK-*-ADMIN-to-PM.md 启动 v0.2 sprint 0
5/20+ → +5-7 工作日           v0.2 sprint 0 = 5→7 schemas + Boundary + needs_human 处置（删 / 转 capability）
                              → v0.2.0-alpha.1 npm publish（首次公开发布）
                              → push v0.2.0-alpha.1 tag 到 origin
```

---

## §七 PM 自约束工作完整 audit trail（本会话）

| 触发 | 类别 | 处置 |
|---|---|---|
| ADMIN 5/9 13:51 第 3 句宪法（schema 哲学）| ❌ 修宪 | 写 §0.0 解读表 + §3.0 设计哲学节（DEV 顺手做完）|
| ADMIN 5/9 14:46 第 4 句宪法（治理三动作）| ❌ 修宪 | 写 §0.0 解读表 + 第 4 句 |
| ADMIN 5/9 16:36 第 5 句宪法（按推荐永久授权）| ❌ 修宪 | 写 §0.0 解读表 + 第 5 句 + PM 自约束条款 10 行表 |
| FCoP issue #2 v1.0 RC.1 reply 5/9 14:59 | 4 类「仍请示」全触发 | 写 REPORT-023 紧急请示 5 议题 |
| ADMIN 5/9 23:14「按推荐」覆盖 5 议题 | 隐式授权 | 起草 4 文档 + v0.2 sprint 0 路线图（draft）+ issue #2 reply 草稿 |
| DEV-028 5 surprise | 全部「sub-decision 接受」类 | PM 自决全盘接受 |
| 本里程碑通报（REPORT-025）| 「常规推荐」类 | PM 自决发出 |

→ **本会话 PM 严格遵守自约束条款**：6 类「仍请示」全部主动请示（5/9 13:51-16:36 三轮修宪 + 5/9 23:01 紧急请示）；其余路径全部 PM 自决执行。

---

## §八 何时再写下一封 PM-to-ADMIN

按第 5 句宪法 + PM 自约束触发条件：

1. **OPS-030 + QA-031 完工时**（~50 min 后）— 写 `REPORT-026-PM-to-ADMIN：v0.1.0-rc.1 试用就绪通知`，简短 1-2 段 + 试用引导链接
2. **任何 surprise 升级为「仍请示」时** — 立即写紧急请示
3. **fcop@1.0.0 final 落地时**（5/16-5/20）— 写 `REPORT-XXX-PM-to-ADMIN：v0.2 sprint 0 启动判据全满足，请示开炮`（这是「仍请示」的 npm publish 触发节点 + 跨 sprint 路线变更确认）

ADMIN 试用过程中如发现问题，请直接写 `TASK-*-ADMIN-to-PM.md`，PM 立即接管。

---

PM-01 报送。状态：S5/S6 全数交付 + 14 子模块就绪 + 距 v0.1 RC 出厂 ~50 min + v0.2 sprint 0 路线图（draft）就绪 + issue #2 reply 草稿待 ADMIN 选 a/b/c/d。
