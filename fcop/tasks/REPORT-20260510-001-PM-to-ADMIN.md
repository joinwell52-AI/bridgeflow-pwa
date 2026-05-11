---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260510-001
sender: PM
recipient: ADMIN
priority: P0
thread_key: codeflow-v0.1.0-rc.1-internal-preview-trial-ready
references:
  - REPORT-20260509-025-PM-to-ADMIN
  - REPORT-20260509-030-OPS-to-PM
  - REPORT-20260509-031-QA-to-PM
  - TASK-20260509-030-PM-to-OPS
  - TASK-20260509-031-PM-to-QA
  - TASK-20260510-001-PM-to-OPS
layer: governance
---

# REPORT-20260510-001：v0.1.0-rc.1 试用就绪通报

## 一句话结论

**CodeFlow v0.1.0-rc.1 internal preview 已实质出厂，QA 正式推荐 ADMIN 内测。** OPS-030 commit `c3ac9dd` 三仓同步、本地 annotated tag 锁定、QA E2E 三场景全 ✅、94/94 baseline 不变；ADMIN 现在可以照 §三 一页指南启动试用，全程不依赖 PM/DEV/OPS/QA。

---

## §一 出厂状态快照

| 维度 | 值 / 证据 |
|---|---|
| **commit** | `c3ac9dd` `feat(s6-codeflow-shell): v0.1.0-rc.1 internal preview MVP`（22 文件 / 3844+3-）|
| **本地 tag** | `v0.1.0-rc.1`（annotated，指向 `c3ac9dd`）|
| **origin/backup HEAD** | 全部同步至 `c3ac9dd`（gitee 仍 `62532a7` per HANDOFF-001 G3）|
| **origin/backup tags** | **不**含 `v0.1.0-rc.1`（A.1 internal RC 语义：内测，不公开）|
| **runtime baseline** | tests 94 / pass 94 / fail 0（OPS-030 未动 runtime src/）|
| **E2E 三场景** | banner ✅ / governance loop ✅ / Ctrl+C ✅（代码审查 + 自动化限制委托交互式）|
| **5 项发布前置** | 4/5 严格 ✅ + 1「偏差」=origin tag 未推 → **按设计，不偏差**（详见 §五）|

参考：[REPORT-030-OPS](REPORT-20260509-030-OPS-to-PM.md) §11 验收 + [REPORT-031-QA](REPORT-20260509-031-QA-to-PM.md) §二/三/四。

---

## §二 v0.1 Backend Kernel 自评

按 §0.0 第 3 总纲「**约束 + 能力 + 状态 + 权限 → 不会崩溃的协作宇宙**」逐条核验：

| 总纲维度 | v0.1 兑现度 | 证据 |
|---|---|---|
| **约束**（Schema / 边界）| ✅ 5 schemas（agent/task/review/session/skill）+ KernelDependencyValidator | TS-7.x 17 测试，hard-fail on missing fcop |
| **能力**（Skill / MCP）| ✅ SkillRegistry + MCPInjector(stub) + 默认装载 | hello-world 启动日志「Skills loaded : 3」「MCP injector : mode='stub' (2 agents mounted)」|
| **状态**（Session / Persistent）| ✅ SessionManager + PersistentStore + 4 transcripts/4 sessions per task | governance loop E2E 实证 |
| **权限**（Layer / NeedsHumanGate）| ✅ Worker/Governance/Admin 三层 + needs_human fallback | TS-6.9 + REPORT-031 §三 实证 `verdict_parse_failed → NeedsHumanGate` |
| **不会崩溃**（Bootstrap / Reconciler）| ✅ 14 子系统 composition + crash recovery + AgentStatusReconciler | bootstrap report `success=0, failed=0, kernel_failures=0` |

---

## §三 ADMIN 试用一页指南（最快路径）

> 前提：Node ≥ 20。完整 `npm install` 首次约 30 秒，启动后 < 2 秒看到 banner。

```powershell
# 终端 1 — 启动 runtime
cd D:\Bridgeflow\codeflow-shell
npm install      # 首次必跑；后续可省
npm start
# 等 banner 出现：Status : running. Drop TASK-*-XXX-to-AGENT.md to inbox.

# 终端 2 — 投递 sample task
copy D:\Bridgeflow\codeflow-shell\examples\hello-world\sample-task.md `
     "$env:USERPROFILE\.codeflow\v2\inbox\TASK-20260510-999-PM-to-DEV.md"
# 约 5 秒内终端 1 出现 [NeedsHumanGate] human approval required: ...

# 终端 1 — 优雅退出
# 按 Ctrl+C；预期看到：[shell] runtime stopped cleanly. Goodbye.
```

**产物落点**：`%USERPROFILE%\.codeflow\v2\` 下：
- `inbox/TASK-*.md`（含 state_history 追加）
- `sessions/session-*.json`（4 件 / 每 task）
- `transcripts/run-mem-*.md`（4 件 / 每 task）
- `reviews/REVIEW-20260510-999-REVIEW-on-TASK-...md`（含 `decision: needs_human`）

**关键 banner 片段**（看到这个 = 启动成功）：

```
CodeFlow v0.1.0-rc.1 — internal preview
Skills loaded  : 3 (fcop, git, review)
MCP injector   : mode="stub" (2 agents mounted)
Bootstrap      : success=0, failed=0, kernel_failures=0
Status         : running. Drop TASK-*-XXX-to-AGENT.md to inbox.
```

完整版含截图建议见 [REPORT-031-QA](REPORT-20260509-031-QA-to-PM.md) §七。

---

## §四 已知 known-issues（不阻塞试用）

| # | 现象 | 处置 / 影响 |
|---|---|---|
| K1 | Node SEA EXE 打包暂不可用（`@cursor/sdk` ESM/CJS） | `npm start` = 正式 fallback，与 EXE 行为完全等价；EXE 推 v0.2 |
| K2 | Windows 非交互式 `child_process.spawn` 无法可靠传 SIGINT | 试用时**在交互式终端**按 Ctrl+C 即可；自动化场景需 `runtime.stop()` API |
| K3 | review verdict = `needs_human`（fake SDK adapter 不输出 VERDICT）| **预期行为**：v0.1 用 fake adapter，v0.1.x 接真 Cursor SDK 后 verdict 自动恢复 `approved/rejected/...` |
| K4 | EPERM 偶发（atomic-write 跨进程 rename）| 0 功能影响；retry-on-EPERM 推 v0.2 sprint 0 |

---

## §五 QA「1 项偏差」处置

QA-031 §五标的「偏差 = origin/backup tag 未推」**实际是按 A.1 设计锁死的 internal RC 语义**（[TASK-030 §一](TASK-20260509-030-PM-to-OPS.md)：本地 tag 创建但**不**推 origin/backup）。

**PM 处置**：不补推。internal RC 公开可见性需等待 v0.2 sprint 0 schema 对齐 fcop@1.0 final 后再决定。

→ 已记入 §0.0 第 5 总纲「PM 推荐默认通过」自决审计：本次自决 1 项（拒绝补推 tag），属常规推荐，不需要 ADMIN 表态。

---

## §六 ADMIN 待办（按重要度排序）

| 优先级 | 待办 | 当前阻塞 | PM 推荐 |
|---|---|---|---|
| **P1** | 试用 v0.1.0-rc.1（按 §三 一页指南）| 无 — 立即可启 | 5-10 分钟体感闭环 |
| **P1** | 拍板 [DRAFT-001 issue #2 reply](DRAFT-20260509-001-PM-to-ADMIN-issue-2-reply.md) 选 a/b/c/d | 已就绪 5 天 | **PM 推荐 b 短版**（直接 ack 上游 3 问） |
| **P2** | 等 fcop@1.0 final 落 PyPI（5/16-5/20）→ 启动 v0.2 sprint 0 | 上游 release | 5-7 工作日工期，已有 [v0.2 sprint 0 roadmap](../../design/v0.2-sprint0-roadmap.md) 草稿 |
| **P3** | 试用反馈（任何形式 — 文字/截图/issue）| ADMIN 试用完 | 反馈先归集，v0.2 sprint 0 启动时统一处理 |

---

## §七 PM 自约束审计（本轮）

按 §0.0 第 5 总纲，本轮 PM 自决 vs 上交清单：

| 决策 | 性质 | 处置 |
|---|---|---|
| 接受 DEV-028 5 项 surprise（K1-K4 + main.ts 模板偏差）| 常规推荐 | 自决 ✅ — 已含「v0.2 sprint 0 align」承诺 |
| 接受 QA-031「1 项偏差」处置（不补推 tag）| 常规推荐 | 自决 ✅ — 锁定 A.1 internal RC 语义 |
| 派 TASK-20260510-001-PM-to-OPS（closing docs commit）| 常规推荐 | 自决 ✅ — 流程归档 |
| **A.1/B.1/C.1/D.1/E.1 五大决策**（fcop v1.0 alignment） | 重大变更 | ❌ 上交 → 已 5/9 23:14 ADMIN「按推荐！」拍板 |
| **v0.1.0-rc.1 公开发布（npm publish / GitHub Release）**| 重大变更 | ❌ 上交 → 已锁定「不公开」per A.1，等 v0.2 |

→ 本轮 0 越权，0 漏报。

---

## §八 horizon

| 节点 | 时间 | 触发 |
|---|---|---|
| ADMIN 试用 | now | §三 一页指南 |
| ADMIN 拍板 issue #2 reply | now（已就绪 5 天）| DRAFT-001 § review checklist |
| fcop@1.0.0 final → PyPI | 5/16-5/20（上游）| 监听 GitHub release tag |
| **v0.2 sprint 0 开炮**| fcop@1.0 final 后 24h 内请示 ADMIN | 7 schemas 重写 + Boundary 升级（5-7 工作日）|
| **v0.1.0 stable 公开发布**| v0.2 sprint 0 完工后 | 公开 tag + npm publish + GitHub Release |

---

## §九 一句话送 ADMIN

> v0.1 Backend Kernel 已闭环，**ADMIN 的核心工作从此回到「下达 / 审批 / 变更」**（§0.0 第 4 总纲）；
> 试用 → 反馈 → fcop@1.0 → v0.2 sprint 0 → v0.1.0 stable，是清晰的下一个 5-10 工作日路径。
>
> v0.1.0-rc.1 internal preview 等你试。

PM-01
2026-05-10 00:55 (UTC+8)
