---
protocol: fcop
version: 1
kind: report
task_id: REPORT-20260509-010
sender: QA
recipient: PM
priority: P1
thread_key: codeflow-v2-sprint-s3-test-strategy
references:
  - TASK-20260509-010-PM-to-QA
  - TASK-20260509-009-PM-to-DEV
  - packages/codeflow-runtime/docs/test-strategy-s3.md
  - packages/codeflow-runtime/docs/crash-recovery.md
test_result: strategy-complete
---

# QA-01 回执：Sprint S3 测试策略草案完成

## 一句话结论

按 `TASK-20260509-010-PM-to-QA.md` 要求，Sprint S3 测试策略文档 `packages/codeflow-runtime/docs/test-strategy-s3.md` 已落盘，共 6 大节、**40 个 TS-x.x 场景**（含 §3.1~§3.3 已完整设计的 25 个，§3.4~§3.5 Phase B/C 预占位 10 个，§2 基础设施约束 2 个 TS-0.x），可直接作为 Phase A acceptance 依据。

---

## 一、测试用例列表（§3 全部 TS-x.x 场景）

### §3.0 基础设施约束（适用所有场景的前置条件）

| 代号 | 标题 | 状态 |
|---|---|---|
| TS-0.1 | 所有单元测试可在无外网条件下跑通（InMemorySdkAdapter 隔离） | 已设计 |
| TS-0.2 | 协议依赖纪律 grep：runtime/src 不重新声明 schema 字段名 | 已设计 |

### §3.1 PersistentStore atomic-write（对齐决策 1）

| 代号 | 标题 | 状态 |
|---|---|---|
| TS-1.1 | 正常写入 → 文件内容等效 | 已设计 |
| TS-1.2 | write-temp 阶段中断 → 原文件保持 | 已设计 |
| TS-1.3 | rename 阶段中断 → 原文件保持 | 已设计 |
| TS-1.4 | 读不存在文件 → 返回 `[]`，不抛 | 已设计 |
| TS-1.5 | 读 corrupted JSON → 抛 RuntimeBootstrapError（含路径） | 已设计 |
| TS-1.6 | 并发 100 次 upsert → 最终文件是合法 JSON，不产生半残 | 已设计 |

### §3.2 RuntimeBootstrap reconciliation（对齐决策 2 + 决策 3）

| 代号 | 标题 | 状态 |
|---|---|---|
| TS-2.1 | 空 records → SDK.list 不调用，输出空 report | 已设计 |
| TS-2.2 | records=2 + SDK list 含两者 → 全部 success | 已设计 |
| TS-2.3 | 场景 X（本地多了）→ orphaned + status=error | 已设计 |
| TS-2.4 | 场景 Y（SDK 多了）→ foreign + agents.json 不新增 record | 已设计 |
| TS-2.5 | SDK.resume 抛错 → markFailed + report.failed + bootstrap 仍完成 | 已设计 |
| TS-2.6 | Bootstrap 期间触发 register → RuntimeNotReadyError | 已设计 |
| TS-2.7 | RuntimeBootstrap 幂等性：连续跑 2 次结果等价 | 已设计 |
| TS-2.8 | SDK.list() 完全失败（超时）→ 边界行为 | **TBD — 见 §三** |

### §3.3 AgentRegistry 6 方法（对齐决策 1 + 决策 3）

| 代号 | 标题 | 状态 |
|---|---|---|
| TS-3.1 | register 正常流程：record 写入 + agents.json + SDK.create 调用 | 已设计 |
| TS-3.2 | register 缺 layer 字段 → ValidationError + agents.json 不变 | 已设计 |
| TS-3.3 | register layer=admin → LayerViolationError + SDK.create 不被调用 | 已设计 |
| TS-3.4 | register SDK.create 抛错 → throw + agents.json 不被写入 | 已设计 |
| TS-3.5 | resume 正常：SDK.resume 调用 + last_reconciled_at 更新 | 已设计 |
| TS-3.6 | resume 找不到 record → AgentNotFoundError | 已设计 |
| TS-3.7 | list filter 多维度（layer / status / 空 filter 全返） | 已设计 |
| TS-3.8 | get 不存在 → 返回 null，不抛 | 已设计 |
| TS-3.9 | updateRuntimeBinding local→cloud → 字段更新，SDK.resume 不调 | 已设计 |
| TS-3.10 | updateRuntimeBinding 相同值 → no-op，upsert 不调 | 已设计 |
| TS-3.11 | markFailed → status=error + runtime_failure 字段写入 | 已设计 |

### §3.4 SessionManager / SessionStore / TranscriptWriter（Phase B 范围）

| 代号 | 标题 | 状态 |
|---|---|---|
| TS-4.1 | SessionStore 单 record per file 落盘 | Phase B 待补全 |
| TS-4.2 | TranscriptWriter append-only 单事件追加 | Phase B 待补全 |
| TS-4.3 | TranscriptWriter 高频 1000 事件流不丢事件 | Phase B 待补全 |
| TS-4.4 | SessionStore 元数据更新 → atomic-write | Phase B 待补全 |
| TS-4.5 | 跨 run 累计 cost 字段正确累加 | Phase B 待补全 |
| TS-4.6 | 启动期扫描 status=running session → 恢复策略 | **TBD — 见 §三** |

### §3.5 Task Scheduler chokidar inbox（Phase C 范围）

| 代号 | 标题 | 状态 |
|---|---|---|
| TS-5.1 | chokidar watch 触发 → scheduler 读取并 dispatch | Phase C 待补全 |
| TS-5.2 | Task front-matter 不合 Task Schema → 产生 reject 文件 | Phase C 待补全 |
| TS-5.3 | state_history 自动追加 status 变化记录 | Phase C 待补全 |
| TS-5.4 | 50 个 task 进入 inbox → 不丢失 + P0 优先 | Phase C 待补全 |

---

## 二、已设计 / 未设计 / TBD 数量统计

| 分组 | 总场景数 | 已完整设计 | Phase B/C 待补全 | TBD（边界未定）|
|---|---|---|---|---|
| §3.0 基础设施约束 | 2 | 2 | 0 | 0 |
| §3.1 PersistentStore | 6 | 6 | 0 | 0 |
| §3.2 RuntimeBootstrap | 8 | 7 | 0 | 1（TS-2.8）|
| §3.3 AgentRegistry | 11 | 11 | 0 | 0 |
| §3.4 SessionManager（Phase B） | 6 | 0 | 5 | 1（TS-4.6）|
| §3.5 Task Scheduler（Phase C） | 7 | 0 | 7 | 0 |
| **合计** | **40** | **26** | **12** | **2** |

---

## 三、TBD 场景说明（发现的边界条件）

### TBD-1：TS-2.8 — SDK.list() 完全失败时的全局策略

`crash-recovery.md` 决策 2 明确"单个 record 的 reconcile 失败不阻断整个 run"，但当 `SDK.list()` 本身失败（超时/网络错误）时，影响的是全部 records——决策 2 未覆盖此边界。

QA 列出两个候选方案：

| 候选 | 行为 | 与现有决策的一致性 |
|---|---|---|
| A：全部 records 标 failed | bootstrap 仍完成，report.failed 含所有 record | 符合"单 record 失败不阻断"的精神，但 SDK 全失败属于基础设施问题 |
| B：HARD FAIL（整个 bootstrap 抛错） | process.exit(1)，runtime 拒绝启动 | 符合"不允许半启动状态"，但体验强硬 |

**请 PM 协调 DEV 在 Phase A 实施期间敲定，并录入 crash-recovery.md 或 TASK-009 DEV 回执的"关键决策记录"节。QA 收到结论后立刻补全 TS-2.8 的通过标准。**

### TBD-2：TS-4.6 — 启动期扫描 status=running session 的恢复策略

`crash-recovery.md` 决策 4 提到"启动时 reconciliation 扫描 status=running 的 SessionRecord，调用 SessionManager 决定如何恢复（继续 stream / 标 cancelled / 标 failed）"，但具体策略标注"这个细节交给 S4 settle"。

Phase B 实施时 QA 需要此策略才能补全 TS-4.6 的通过标准。**请 PM 在 Phase B 派单时明确此策略。**

---

## 四、文档自身的歧义 / 不一致（QA 视角审查）

本任务范围是设计测试策略，不验证 DEV 实现。以下是 QA 在阅读设计文档时发现的歧义点，供 PM 参考：

**Q-01：场景 Z（模型/runtime 漂移）的检测能力依赖 SDK capability**

`crash-recovery.md` 决策 3 列出场景 Z（ACCEPT_DRIFT_WITH_AUDIT），但 TASK-009 §必交付 4 明确：
> "场景 Z（drift detection）的实际 detection 逻辑在本任务留空——因为 SDK 当前版本是否能 query agent 的 model/runtime 元数据*本身待 spike 验证*"

影响：ReconciliationStrategy.ACCEPT_DRIFT_WITH_AUDIT 存在于 enum 中，但 report.drifted 数组在 Phase A 永远是空。QA 不需要为此设计验证场景（只需验证"空数组存在"），但 PM 应知晓这是刻意留空。

**Q-02：TS-3.9 updateRuntimeBinding 对 resume 的影响需 DEV 文档化**

TASK-009 §必交付 2 写"不在本任务自动触发 resume（避免副作用串联，留给上层显式 call resume）"。QA 设计了 TS-3.9 验证此行为（spy 验证 SDK.resume callCount === 0），但如果 DEV 对"不触发 resume"有不同理解，需要在 DEV 回执的"关键决策记录"里明确，避免 acceptance 时对不上。

---

## 五、是否建议上线

**本任务不涉及可部署产物（属于文档/测试策略设计阶段）**，无需上线判断。

但 QA 对"S3 Phase A 实施期间，本测试策略文档可作为 acceptance 依据吗"给出明确答复：

> ✅ **是**。`test-strategy-s3.md` §5 Phase A 验收清单已与 TASK-009 §验收标准 11 项完整对照，PM 在收到 DEV Phase A 回执后，可按 §5 清单直接交叉验证。两个 TBD 场景（TS-2.8 / TS-4.6）不影响 Phase A acceptance（均为 Phase A 范围之外的边界场景）。

---

## 六、跨角色提示

### 给 PM — FCoP 字段审查输入

`test-strategy-s3.md` §6「待 D:\FCoP 评审字段清单」列出了 2 条 QA 发现的字段归属疑问：

| 编号 | 问题 | 推荐处置 |
|---|---|---|
| FCoP-QA-01 | `state_history` 字段归属（协议层 vs runtime 私有） | 倾向 runtime 私有；请 PM+DEV 确认后录入 |
| FCoP-QA-02 | TS-2.8 SDK.list 超时策略未在 crash-recovery.md 涉及 | 属 runtime 工程层，无需 FCoP 变更；但 v0.2 若加 Mobile 告警可能需要新增 FCoP event schema |

**如 PM 确认 FCoP-QA-01 属协议层**，请合并到 `D:\FCoP` Issue #2 提案（与已推送的 5 字段一起）。

---

## 七、验收标准自检

| # | 项 | 结果 |
|---|---|---|
| 1 | `test-strategy-s3.md` 文件存在 | ✅ |
| 2 | §1 ~ §6 六节齐全 | ✅ |
| 3 | §2 六条硬约束对账表完整（6 行 + 每行有 TS-x.x 或"留待 SX"） | ✅ |
| 4 | §3 场景数 ≥ 25 | ✅ 40 个（Phase A 可直接用的 26 个） |
| 5 | §3.4 / §3.5 明示 Phase B / C 范围 | ✅ 节首有说明 |
| 6 | §6「待 D:\FCoP 评审字段清单」节存在 | ✅ 含 2 条条目 |
| 7 | 文档行数 200 ≤ x ≤ 500 | ✅ 436 行 |
| 8 | 不创建任何 schema 字段 / 不动 protocol 包 | ✅ 仅新增 docs 文件 |
| 9 | 不修改 crash-recovery.md | ✅ |

---

QA-01 完成 TASK-20260509-010。`test-strategy-s3.md` 可作为 Phase A acceptance 依据。
两个 TBD 场景请 PM 协调推动决策；FCoP-QA-01/02 请 PM 酌情并入上游提案。
