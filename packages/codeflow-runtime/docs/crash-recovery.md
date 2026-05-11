# Crash Recovery — 4 决策（Sprint S2 设计）

> 本文件是 `@codeflow/runtime` 包的设计稿 —— 仅文档，不实现。S3 sprint 按本文件结论实现。
>
> 派单依据：[`fcop/tasks/TASK-20260509-002-PM-to-DEV.md`](../../../fcop/tasks/TASK-20260509-002-PM-to-DEV.md) §必交付 5。
> 上游设计：[`docs/design/codeflow-v2-on-fcop-sdk.md`](../../../docs/design/codeflow-v2-on-fcop-sdk.md) §2.1（State Store 子系统 6）+ §0.8.2（v0.1 第 3 条硬约束「进程能恢复」）。
>
> 总长度约 230 行；4 问答各含 ≥ 30 行论证 + 明确推荐方案。

---

## 决策 1：`agents.json` 何时写入？

### 选项

| ID | 策略 | 写入时机 |
|---|---|---|
| A | **每次写操作后立刻 fsync** | `register / resume / updateRuntimeBinding / markFailed` 每次都 atomic-write + fsync |
| B | **定期 batch 落盘** | 内存中累积修改，每 N 秒 / 每 M 次写触发一次落盘 |
| C | **仅退出时落盘** | 全程内存；只有 SIGTERM / 优雅 shutdown 时才写 |

### 论证

- v0.1 唯一目标（§0.8.2）= 一个 Runtime 能稳定驱动 4 状态 Agent 流水线，**全程文件化、可追溯、可恢复**。「可恢复」= 任何崩溃后重启都能 resume 到崩溃前一刻的 PCB 状态。这条约束直接 *否决* 选项 C —— 进程被 `kill -9` 不会有 shutdown 钩子机会，C 等于 100% 数据丢失。
- 选项 B 在传统 DB 设计里很常见（journal log + checkpoint），但前提是 *journal log 本身* 是 fsync 的——B 的"内存累积"等于把 journal log 也放内存了，崩溃窗口期内的写丢失。要补 journal log = 复杂度直接对齐 SQLite 级别，与 v0.1 的"最简单实现"哲学冲突（§10.2 S2 描述：`agents.json` 持久化）。
- 选项 A 的代价 = fsync 的 IO 延迟（典型 SSD < 10ms / 写）。AgentRegistry 的写操作频率极低（agent 注册一次后只在 status 变化时写，每 agent 每天 < 100 次），fsync 累计开销在毫秒/天量级，不构成性能问题。
- A 的工程实现路径成熟：write-temp-file + atomic rename + fsync(parent dir) 是 POSIX-safe 的典范模式；Node.js 通过 `fs.writeFile` + `fs.rename` + `fs.fsync(fd)` 可直接实现。Windows 上 `rename` 也是 atomic（NTFS 保证），跨平台无差。
- 反对 A 的常见理由是「频繁 fsync 影响 SSD 寿命」—— 在 v0.1 量级（< 1000 次写/天）下完全不构成问题；这个理由只对 100k QPS 的数据库 workload 成立。

### 推荐

**选项 A（每次写操作后立刻 atomic-write + fsync）**。

S3 实现细节：
- 写流程：`fs.writeFile(`${path}.tmp`, JSON.stringify(records, null, 2))` → `fs.rename(tmp, path)` → `fs.fsync(parent_dir_fd)`
- 错误处理：写失败 = 整个操作（`register` / `markFailed` / 等）抛错；内存状态回滚到写之前
- 观察性：每次写都打 `runtime.persistence_flushed` 日志（不入 RuntimeEvent，是 logger 维度）

---

## 决策 2：进程崩溃后 resume 流程是什么？

### 启动顺序

```
1. 加载 agents.json     ← PersistentStore.loadAll()
   ├─ 文件不存在        → 视为首次启动，PCB = 空数组
   ├─ 文件解析失败      → HARD FAIL，runtime 拒绝启动（不允许污染状态）
   └─ 解析成功           → 进入 reconciliation 阶段

2. Reconciliation        ← 对每个 record 检查 SDK 是否还认得它
   ├─ 调用 SDK Agent.list() 拿当前 SDK 后端的 agentId 全集
   ├─ 对 agents.json 里的每个 record:
   │    ├─ sdk_agent_id 在 SDK 列表里 → SDK Agent.resume(sdk_agent_id)
   │    │     ├─ resume 成功 → 更新 record.runtime_last_reconciled_at = now
   │    │     └─ resume 失败 → markFailed(reason="resume after crash failed: …")
   │    └─ sdk_agent_id 不在 SDK 列表里 → 决策 3 处理
   └─ 输出 reconciliation report 到 stdout（v0.1）/ Mobile（v0.2）

3. Runtime ready          ← 此时所有 record 的 status ∈ {idle, running, error}
                            running 是悬而未决的——交给 Session Manager 决策 4 处理
```

### 设计要点

- **Reconciliation 是同步的**——必须等所有 record 走完一轮再接受新请求。否则会出现 "刚好 SDK 还没 resume 完，新请求触发 register 同名 agent" 的 race。
- **Reconciliation 失败的 record 不阻断启动**——单个 agent 的 SDK resume 失败，标记 failed 即可；不要让 1 个坏 agent 阻断整个 runtime。这是 §0.6.7 治理化护城河的反向兑现：可观察 + 可治理 ≠ 必须 100% 成功。
- **Reconciliation 是幂等的**——多次启动 / kill -9 重启 / 手工 trigger，结果都一样。fsync 写策略（决策 1）保证 PCB 文件不会半残。
- **不在 reconciliation 期间触发 register**——这是 race 防御，必须用启动期 mutex / 状态机标志 守护。

### 推荐

按上方启动顺序实现。S3 关键交付：
- `RuntimeBootstrap` 类负责整个启动流程
- `ReconciliationReport` 类型记录每个 record 的 reconcile 结果（success / failed / not_in_sdk）
- 启动失败的 detected 路径全部走 `process.exit(1)` + 清晰错误消息，不允许"半启动"状态

---

## 决策 3：`agents.json` 与 SDK 后端不一致时怎么办？

### 触发场景

reconciliation 阶段（决策 2 第 2 步）发现：

| 场景 | agents.json | SDK 后端 |
|---|---|---|
| **场景 X：本地多了** | 有 record，sdk_agent_id = `agent-aaa` | `agent-aaa` 不在 `Agent.list()` 返回里 |
| **场景 Y：SDK 多了** | 没有对应 record | `Agent.list()` 返回了陌生 `agent-bbb` |
| **场景 Z：模型/runtime 漂移** | record.runtime = `local` | SDK 端 agent 实际是 `cloud` 起的 |

### 选项

| ID | 策略 | 适用场景 | 风险 |
|---|---|---|---|
| A | **信本地（PCB 优先）** | 默认 | 可能掩盖 SDK 端的真实变更 |
| B | **信 SDK** | 默认 | agents.json 被覆盖，丢治理记录 |
| C | **报错让人肉决策** | 默认 | runtime 启动被阻断 |

### 论证

- 三种场景应该分别决策，而不是一刀切：
  - **场景 X**：本地多了 = SDK 那边 agent 被外部删了（团队成员从 Cursor.com 后台清的）。**信本地是错的**，因为 sdk_agent_id 已经死了，再 `Agent.resume()` 必然失败。**信 SDK 也是错的**，因为我们会丢 agent 的 layer / role / 治理元数据。**唯一对的做法**：把 record 标 `failed`（reason="orphaned: SDK no longer recognizes this sdk_agent_id"），保留 PCB 信息以便 audit；让 ADMIN 决定是否清理 / re-register。
  - **场景 Y**：SDK 多了 = 有人在 Cursor.com 后台手工开了 agent，没经过 runtime。这违反了 §0.9.1 治理纪律（agent 必须经 runtime register 进 PCB）。**正确响应**：警告日志 + 在 reconciliation report 里列出，但 *不接管* —— 不接管 = 不写进 agents.json，runtime 不为它负责。这条 SDK 端 agent 仍然能在 Cursor.com 后台用，但 CodeFlow runtime 不管它。
  - **场景 Z**：模型 / runtime 漂移 = SDK 端的真实参数与 PCB 记录不一致。**信本地是错的**，因为 SDK 才是 ground truth。**信 SDK 是对的**，但要 *提示 ADMIN* —— 漂移意味着可能有外部修改。所以：以 SDK 为准更新 PCB + 在 reconciliation report 里标"drift detected: model changed from X to Y"。
- 上面三种处理都不是简单的 A/B/C —— 是三种场景三种策略，统称 **"按场景分流 + 全部 audit"**。
- **任何一种场景都不允许 silent overwrite agents.json** —— overwrite = 丢 audit trail = 违反 §0.6.7 护城河。

### 推荐

**按场景分流：场景 X 标 failed；场景 Y 警告并不接管；场景 Z 以 SDK 为准 + 漂移记录**。

S3 关键交付：
- `ReconciliationStrategy` enum：`{ORPHAN_LOCAL, IGNORE_FOREIGN, ACCEPT_DRIFT_WITH_AUDIT}`
- `reconcile()` 方法返回 `ReconciliationReport`，包含每个 record 的处理结果
- 启动期 stdout 输出 reconciliation summary，让操作者一眼看到当晚环境是否干净

---

## 决策 4：`SessionRecord` 是否也需要持久化？与 transcript 文件的边界？

### 选项

| ID | 策略 | 持久化范围 |
|---|---|---|
| A | **完整持久化** | 每个 SessionRecord 单独落 `.codeflow/state/sessions/<session_id>.json` |
| B | **不持久化** | 全在内存；崩溃后丢 + 看 transcript |
| C | **元数据持久化 + transcript 拆分** | SessionRecord 落 JSON（小）；事件流落 transcript markdown（大） |

### 论证

- **必须区分两个东西**：(a) Session *元数据*（agent_id / task_id / status / runs[]）= 小，结构化；(b) Session *事件流* = 大，半结构化（含 SDK 流出的 token / tool_call / thinking / 各种 message）。把它们混在一起持久化是工程灾难。
- 选项 A 的问题：每次 SDK 流事件都更新 SessionRecord = 每秒可能数十次 fsync = 性能不可接受 + SSD 写放大。
- 选项 B 的问题：违反 §0.8.2 第 2 条硬约束（状态全文件化）+ 违反 §0.6.7 治理化护城河（崩溃 = 失忆 = 不可审计）。
- 选项 C 是分层架构里的标准做法：
  - **元数据**：SessionRecord 是 PCB 的小弟，`session_id` / `agent_id` / `task_id` / `status` / `runs[].run_id` / `started_at` / `ended_at`。这些字段变更频率低（每个 run 启动 1 次 + 结束 1 次），落 `.codeflow/state/sessions/<id>.json` 用决策 1 同款 atomic-write + fsync 模式。一个 session ≈ 1 个 KB 的 JSON 文件。
  - **事件流**：每个 RunHandle 对应 1 个 transcript 文件 `.codeflow/state/transcripts/<run-id>.md`，**append-only**。每个事件以 markdown 段落落盘（带时间戳 + 事件类型）。append-only = 不需要 atomic rename = 高频写也不是问题。
- transcript path 已经在 §3.5 Session Schema 里有字段了：`runs[].transcript_path`。选项 C 是 schema 暗示的方案，schema 设计者已经做过这个判断。
- **边界规则**：
  - 任何 *结构化* 字段（status / tokens / cost / 时间戳）→ SessionRecord JSON
  - 任何 *半结构化 / 文本流* 内容（SDK 消息 / 思考 / 工具结果）→ transcript markdown
  - 任何 *Review record* → 单独的 REVIEW-*.md 文件（FCoP 协议层管，不归 runtime）

### 推荐

**选项 C：元数据持久化 + transcript 拆分**。

S3 关键交付：
- `SessionStore` 接口（与 `PersistentStore` 类比，但单 record per file）
- `TranscriptWriter` 类，订阅 `RuntimeEvent` 并按 run_id 分发到对应的 markdown 文件
- 启动时 reconciliation：扫描 `.codeflow/state/sessions/` 下 status=`running` 的 SessionRecord，调用 SessionManager 决定如何恢复（继续 stream / 标 cancelled / 标 failed —— 这个细节交给 S4 settle）

---

## 4 决策汇总

| 决策 | 推荐 | S3 关键交付物 |
|---|---|---|
| 1 写入时机 | atomic-write + fsync per write | write-temp + rename + fsync(parent dir) |
| 2 启动 resume | reconciliation 同步流程 | `RuntimeBootstrap` + `ReconciliationReport` |
| 3 SDK 不一致 | 按 3 场景分流 | `ReconciliationStrategy` enum + per-record audit |
| 4 SessionRecord 持久化 | 元数据 JSON + 事件流 markdown 拆分 | `SessionStore` + `TranscriptWriter` |

**4 个决策共同保证 §0.8.2 第 3 条硬约束（进程能恢复）落地**。

S3 sprint 启动条件：本文件被 PM-01 review + ADMIN-01 拍板（如果有任何决策需要重新讨论，写在 REPORT-002 的"待 ADMIN 复议事项"节里）。
