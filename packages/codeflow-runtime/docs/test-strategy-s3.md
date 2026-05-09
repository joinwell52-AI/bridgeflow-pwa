# Sprint S3 测试策略文档

> **文件性质**：本文件是 QA-01 为 Sprint S3（AgentRegistry 真实实现 + Session 管理 + Task Scheduler）起草的测试策略草案。  
> **关联任务**：`TASK-20260509-010-PM-to-QA.md`  
> **关联设计**：`packages/codeflow-runtime/docs/crash-recovery.md`（4 决策）、`docs/design/codeflow-v2-on-fcop-sdk.md` §0.8.2 / §10.2  
> **状态**：Draft — 与 DEV Phase A 并行起草，Phase A/B/C 各阶段 acceptance 时使用对应小节。

---

## §1 测试范围与边界

### §1.1 Sprint S3 全部 Phase 与核心交付物

| Phase | 主题 | 核心交付物 |
|---|---|---|
| **Phase A**（TASK-009） | AgentRegistry + PersistentStore + RuntimeBootstrap | `PersistentStore.ts`（atomic-write+fsync）、`AgentRegistry.ts`（6 方法实现）、`RuntimeBootstrap.ts`（reconciliation 流程）、`ReconciliationReport` 类型、`ReconciliationStrategy` enum、`AgentSdkAdapter` 接口、11 场景单元测试 |
| **Phase B** | SessionManager + SessionStore + TranscriptWriter | `SessionManager.ts`（6 方法实现）、`SessionStore`（单 record per file）、`TranscriptWriter`（append-only markdown）|
| **Phase C** | Task Scheduler chokidar inbox | chokidar inbox 门铃、state_history 自动追加、E2E mini demo |

### §1.2 本测试策略覆盖范围

- `AgentRegistry` — 6 方法（register / resume / list / get / updateRuntimeBinding / markFailed）
- `PersistentStore` — atomic-write + fsync + loadAll/saveAll/upsert/removeById
- `RuntimeBootstrap` — 全量 reconciliation 三场景（X/Y/Z）+ 幂等性 + race 防御
- `SessionManager` — 6 方法（Phase B）
- `SessionStore` — 单 record per file 持久化（Phase B）
- `TranscriptWriter` — append-only markdown 写入（Phase B）
- `Task Scheduler` — chokidar inbox 门铃 + priority dispatch（Phase C）

### §1.3 本测试策略**不覆盖**

- `Skill Runtime`（S5 范围）
- `Review Engine`（S4 范围）
- Mobile Push / WebSocket 通知（v0.2 范围）
- E2E 多角色全流程验收（S6 范围）
- `@codeflow/protocol` schema fuzz（已由 protocol 包的 AJV fixtures 间接覆盖，不在本策略重复）
- `CursorSdkAdapter` 的真实网络连通性（需要真实 Cursor.com 账号，不在 v0.1 单元测试范围；接入层由 `InMemorySdkAdapter` 隔离）

---

## §2 与 v0.1 硬约束对齐表

按 `docs/design/codeflow-v2-on-fcop-sdk.md` §0.8.2 六条硬约束逐项对账：

| # | 硬约束 | 由 S3 哪个组件兑现 | 本策略对应测试场景 |
|---|---|---|---|
| **#1** | 全流程零 UI，纯文件 + CLI 驱动 | RuntimeBootstrap（stdout report）/ Task Scheduler（inbox 门铃） | TS-2.x / TS-5.x |
| **#2** | 状态变更全文件化，可追溯 | PersistentStore atomic-write / SessionStore / TranscriptWriter | TS-1.x / TS-4.x |
| **#3** | 进程崩溃能恢复（任意 kill -9 后可 resume） | RuntimeBootstrap reconciliation 三场景 + PersistentStore | TS-1.x / TS-2.x |
| **#4** | 每步必须有 reviewer（Review Engine） | 留待 S4 Review Engine，本 sprint 不覆盖 | — |
| **#5** | 不依赖云端，可纯本地跑（InMemorySdkAdapter） | 所有单元测试均可在无网环境通过 | TS-0.x（跨所有 §3 场景适用） |
| **#6** | fcop 强依赖（协议纪律完整） | 留待 S5 Skill Runtime；S3 阶段体现为"runtime 私有类型不污染 protocol 包" | TS-0.2 |

> **TS-0.x（基础设施约束）**：适用于所有 §3 场景的前置条件。
> - **TS-0.1** 所有单元测试必须可在无外网条件下跑通（使用 `InMemorySdkAdapter`，无实际 SDK 网络调用）
> - **TS-0.2** `packages/codeflow-runtime/src` 不出现 `@codeflow/protocol` 的 schema 字段名*重新声明*（`interface Agent { agent_id: ... }` 类型等），只可 `import type ... from "@codeflow/protocol"`——用 `grep` 跑验证

---

## §3 测试场景设计（详细列表）

> 每场景格式：场景代号 + 输入 / 操作步骤 / 期望输出 / 通过标准 / 测试类型。  
> 测试类型：**unit**（隔离 + InMemorySdkAdapter）/ **integration**（真实文件系统 + InMemorySdkAdapter）/ **手工**（需要人工操作）

---

### §3.1 PersistentStore atomic-write（对齐决策 1）

**TS-1.1 正常写入 → 文件内容等效**
- 输入：1 个合法 `AgentRecord`
- 操作：`store.upsert(record)` → 读取 `agents.json`
- 期望：文件存在 + `JSON.parse` 等效原 record 所有字段
- 通过标准：文件 JSON 可解析 + 关键字段（`agent_id`, `layer`, `status`）逐字段断言
- 类型：unit

**TS-1.2 write-temp 阶段中断 → 原文件保持**
- 输入：已有合法 `agents.json` + mock `fs.writeFile` 在写 `.tmp` 时 throw
- 操作：调 `store.saveAll([record])` → 捕获 throw
- 期望：原 `agents.json` 内容**不变**；`.tmp` 文件可见（残留，用作错误诊断）
- 通过标准：原文件 mtime 未变 + 抛出错误消息可读
- 类型：unit

**TS-1.3 rename 阶段中断 → 原文件保持**
- 输入：已有合法 `agents.json` + mock `fs.rename` throw
- 操作：调 `store.saveAll([record])`
- 期望：原 `agents.json` 内容**不变**；新 record 不出现在文件里
- 通过标准：原文件 JSON 解析 = 原内容；抛错可读（含路径信息）
- 类型：unit

**TS-1.4 读不存在的文件 → 返回空数组**
- 输入：`agents.json` 不存在
- 操作：`store.loadAll()`
- 期望：返回 `[]`，**不抛异常**
- 通过标准：返回值 `length === 0`；无 throw
- 类型：unit

**TS-1.5 读 corrupted JSON → 抛 RuntimeBootstrapError**
- 输入：`agents.json` 内容为 `"{ broken json"` 
- 操作：`store.loadAll()`
- 期望：throw `RuntimeBootstrapError`；错误消息包含文件路径
- 通过标准：error instanceof RuntimeBootstrapError；error.message 含路径字符串
- 类型：unit

**TS-1.6 并发 upsert 不产生半残文件**
- 输入：100 次并发 `store.upsert(differentRecord)`
- 操作：`Promise.all([...100 个 upsert])`
- 期望：最终 `agents.json` 是合法 JSON；无 `.tmp` 残留（或即使有也是单一 .tmp 不影响原文件）
- 通过标准：`JSON.parse(finalContent)` 成功；内容为合法 AgentRecord[]（长度可能因 race 而不确定，但不应是 corrupted JSON）
- 类型：integration
- 备注：本场景验证 atomic-rename 模式下并发不产生文件损坏，不验证最终状态的确定性（无锁设计下并发写的最终值由最后一个 rename 决定）

---

### §3.2 RuntimeBootstrap reconciliation（对齐决策 2 + 决策 3）

**TS-2.1 空 records → 跳过 reconcile，空 report**
- 输入：`agents.json` 不存在（首次启动）
- 操作：`bootstrap.run()`
- 期望：`SDK.list()` **不被调用**；`report.success.length === 0`；report 其他数组也为空；stdout 输出 reconciliation summary
- 通过标准：spy 验证 SDK.list 未被调用；report 结构完整但各数组均空
- 类型：unit

**TS-2.2 records=2 + SDK list 含两者 → 全部 success**
- 输入：2 个 AgentRecord，`InMemorySdkAdapter.list()` 返回对应两个 sdk_agent_id
- 操作：`bootstrap.run()`
- 期望：`report.success.length === 2`；两个 record 的 `runtime_last_reconciled_at` 更新；agents.json 持久化更新
- 通过标准：report 断言 + 读取 agents.json 验证字段
- 类型：unit

**TS-2.3 场景 X（本地多了，SDK 已删）→ orphaned + status=error**
- 输入：1 个 AgentRecord（sdk_agent_id=`agent-aaa`）；SDK.list() 返回空
- 操作：`bootstrap.run()`
- 期望：`report.orphaned.length === 1`；该 record 的 `status === "error"`；`reason` 含 "orphaned" 字样；agents.json 里该 record 写入了 `runtime_failure` 字段
- 通过标准：report 断言 + agents.json 内容验证
- 类型：unit

**TS-2.4 场景 Y（SDK 多了，本地无 record）→ foreign + agents.json 不变**
- 输入：agents.json 空（或不存在）；SDK.list() 返回 `["agent-bbb"]`
- 操作：`bootstrap.run()`
- 期望：`report.foreign.length === 1`；agents.json **不新增** agent-bbb 的 record；report.foreign[0].sdk_agent_id === "agent-bbb"
- 通过标准：report 断言 + agents.json 内容（或不存在）验证
- 类型：unit

**TS-2.5 SDK.resume 抛错 → markFailed + report.failed**
- 输入：1 个 AgentRecord；SDK.list() 含该 sdk_agent_id；SDK.resume() throw "connection refused"
- 操作：`bootstrap.run()`
- 期望：`report.failed.length === 1`；`failed[0].reason` 含 "connection refused"；record.status === "error"；**整个 bootstrap 仍然完成**（不 throw 出去）
- 通过标准：无 unhandled throw + report 断言 + agents.json 验证
- 类型：unit

**TS-2.6 Bootstrap 期间触发 register → RuntimeNotReadyError**
- 输入：`InMemorySdkAdapter` 设置 resume 为异步（延迟 100ms）；bootstrap.run() 期间调 `registry.register(spec)`
- 操作：并发 `bootstrap.run()` + `registry.register(spec)`（register 在 bootstrap 内 resume 期间被调）
- 期望：`register()` throw `RuntimeNotReadyError`；`bootstrap.run()` 正常完成
- 通过标准：捕获 RuntimeNotReadyError + bootstrap report 验证完整
- 类型：unit

**TS-2.7 RuntimeBootstrap 幂等性：连续跑 2 次结果等价**
- 输入：2 个 AgentRecord + SDK 含两者
- 操作：`await bootstrap.run()` 两次
- 期望：两次 report 的 success / failed / orphaned / foreign 结构等价；agents.json 两次读取的 record 内容等价（`runtime_last_reconciled_at` 除外）
- 通过标准：key 字段除时间戳外全部 `deepEqual`
- 类型：unit

**TS-2.8 SDK.list() 完全失败（超时/网络错误）→ HARD FAIL（B 路径，PM 5/9 14:00 确认）**

- 输入：`InMemorySdkAdapter` 设置 `plantedListError = new Error("network down")`；PCB 含 ≥ 1 条 record
- 操作步骤：
  1. 构造含 1 条 AgentRecord 的 store
  2. 触发 `bootstrap.run()`
- 期望输出：
  - `bootstrap.run()` **抛出** `RuntimeBootstrapError`
  - error.message 含 `"SDK.list() failed during reconciliation"`
  - error.cause 是原始 SDK error（"network down"）
  - agents.json **不被修改**（仍是 bootstrap 之前的状态；bootstrap 期间未发起任何 saveAll）
- 通过标准：
  - `assert.rejects(() => bootstrap.run(), RuntimeBootstrapError)`
  - error.message 匹配 `/SDK\.list\(\) failed during reconciliation/`
  - spy 验证 store.saveAll callCount === 0（bootstrap 未写文件即中止）
- 类型：unit
- 依据：PM 5/9 14:00「按推荐」+ crash-recovery.md 决策 2 末尾「不允许半启动状态」。DEV 在 Phase B 附加交付 2 中 patch `RuntimeBootstrap.ts` 加 try-catch 翻译 SDK.list 失败为 RuntimeBootstrapError（TASK-013 §附加交付 2）。本场景对应 TASK-013 验收 #4。

---

### §3.3 AgentRegistry 6 方法（对齐决策 1 + 决策 3）

**TS-3.1 register 正常流程**
- 输入：合法 AgentSpec（layer=worker, role=DEV）
- 操作：`registry.register(spec)`
- 期望：返回 AgentRecord（status=idle）；agents.json 存在 + 含该 record；SDK.create 被调用 1 次
- 通过标准：返回值断言 + 文件断言 + spy 验证 SDK.create 调用次数
- 类型：unit

**TS-3.2 register 入参不合 schema → ValidationError**
- 输入：AgentSpec 缺少 `layer` 字段
- 操作：`registry.register(specWithoutLayer)`
- 期望：throw `ValidationError`；agents.json **不变**（或仍不存在）；SDK.create **不被调用**
- 通过标准：error instanceof ValidationError + agents.json 断言 + spy 验证
- 类型：unit

**TS-3.3 register layer=admin → LayerViolationError（SDK.create 不被调用）**
- 输入：AgentSpec { layer: "admin", role: "xxx" }
- 操作：`registry.register(adminSpec)`
- 期望：throw `LayerViolationError`；**SDK.create 绝对不被调用**（先于 SDK 调用完成 reject）
- 通过标准：error instanceof LayerViolationError + spy 断言 SDK.create callCount === 0
- 类型：unit

**TS-3.4 register SDK.create 抛错 → throw + agents.json 不被写入**
- 输入：合法 spec + InMemorySdkAdapter 设置 next-create-throw "sdk error"
- 操作：`registry.register(spec)`
- 期望：throw（原始 SDK 错误包装）；agents.json **不新增** record（atomic-rename 保证原文件不污染）
- 通过标准：捕获 throw + agents.json record 数量断言
- 类型：unit

**TS-3.5 resume 正常流程**
- 输入：预置 fixtures/agents.json 含 1 个 AgentRecord（sdk_agent_id=`agent-ccc`）；SDK.list 含 `agent-ccc`
- 操作：`registry.resume(agentId)`
- 期望：SDK.resume 被调用 1 次；record.runtime_last_reconciled_at 更新；返回更新后的 record
- 通过标准：spy 断言 + 返回值时间戳字段断言 + agents.json 持久化验证
- 类型：unit

**TS-3.6 resume 找不到 record → AgentNotFoundError**
- 输入：空 store
- 操作：`registry.resume("non-existent-id")`
- 期望：throw `AgentNotFoundError`
- 通过标准：error instanceof AgentNotFoundError
- 类型：unit

**TS-3.7 list filter 各维度**
- 输入：3 个 AgentRecord（layer=worker/governance/worker，status=idle/running/error）
- 操作：分别调 `list({ layer: "worker" })`、`list({ status: "idle" })`、`list({})`
- 期望：按 filter 各维度正确过滤；空 filter 返回全部 3 条
- 通过标准：返回数组长度 + 每条 record 的 filter 字段断言
- 类型：unit

**TS-3.8 get 不存在 → 返回 null（不抛）**
- 输入：空 store
- 操作：`registry.get("ghost-id")`
- 期望：返回 `null`，无 throw
- 通过标准：`result === null`；无 unhandled exception
- 类型：unit

**TS-3.9 updateRuntimeBinding local→cloud → 字段更新，不触发 resume**
- 输入：1 个 AgentRecord（runtime=local）
- 操作：`registry.updateRuntimeBinding(agentId, "cloud")`
- 期望：record.runtime === "cloud"；agents.json 持久化更新；**SDK.resume 不被调用**（不触发副作用）
- 通过标准：文件断言 + spy 验证 SDK.resume callCount === 0
- 类型：unit

**TS-3.10 updateRuntimeBinding 相同值 → no-op**
- 输入：1 个 AgentRecord（runtime=local）
- 操作：`registry.updateRuntimeBinding(agentId, "local")`（值不变）
- 期望：agents.json 未发生写操作（mtime 不变）；返回值与原 record 等价
- 通过标准：spy 验证 store.upsert 未被调用 + mtime 断言
- 类型：unit

**TS-3.11 markFailed → status=error + runtime_failure 字段**
- 输入：1 个 AgentRecord（status=running）
- 操作：`registry.markFailed(agentId, "out of tokens")`
- 期望：record.status === "error"；record.runtime_failure.reason === "out of tokens"；runtime_failure.failed_at 为 ISO 时间戳；agents.json 持久化
- 通过标准：返回值断言 + agents.json 内容断言
- 类型：unit

---

### §3.4 SessionManager / SessionStore / TranscriptWriter（Phase B 范围）

> **本节通过标准已在 TASK-014 期间（与 DEV Phase B 并行）全部填实**（TS-4.1~TS-4.5）。TS-4.6 保持"Phase B / Phase C 决议中"，不在 Phase B acceptance 范围内。

**TS-4.1 SessionStore 单 record per file 落盘**

- 输入：`SessionStore.save(sessionRecord)` with `session_id = "sess-xxx"`
- 操作步骤：
  1. 构造 fixture sessionRecord（含 session_id / agent_id / status=running）
  2. 调 `store.save(sessionRecord)`
  3. 检查文件系统
- 期望：
  - `<dir>/sess-xxx.json` 文件存在
  - 文件内容 JSON 等效 sessionRecord（所有字段一致）
  - `<dir>/sess-xxx.json.tmp` 不可见（atomic rename 已完成）
- 通过标准：
  - `await fs.access(path)` 不抛
  - `JSON.parse(await fs.readFile(path, "utf-8"))` deepEqual sessionRecord
  - 目录里没有 `.tmp` 文件
- 类型：unit

**TS-4.2 TranscriptWriter append-only — 单事件追加**

- 输入：`writer.attach(runId, mockHandle)` + 触发 1 个 `message_delta` RuntimeEvent
- 操作步骤：
  1. 构造 MockRunHandle（EventEmitter 模拟，或 spike 的 RunHandle 接口）
  2. `writer.attach(runId, handle)`
  3. 触发 1 个 `message_delta` 事件（content="hello"）
  4. `await writer.close(runId)` flush
  5. 读 transcript 文件
- 期望：
  - `<dir>/<run_id>.md` 存在且包含 1 行 entry
  - 行格式：`[ISO timestamp] [message_delta] payload_summary`
  - **不做 atomic-rename**（append-only 无需；直接 appendFile 或 stream.flags:"a"）
- 通过标准：
  - 文件存在，行数 === 1（close 后计算）
  - 行匹配正则 `/^\[\d{4}-\d{2}-\d{2}T.*Z\] \[message_delta\] /`
- 类型：unit

**TS-4.3 TranscriptWriter 高频 1000 事件流 — 不丢事件**

- 输入：attach 后触发 1000 次 `message_delta` 事件，间隔 0ms
- 操作步骤：
  1. attach mockHandle
  2. 连续触发 1000 个事件
  3. `await writer.close(runId)` flush
  4. 读文件行数
- 期望：
  - 文件行数 **=== 1000**（不少；丢事件 = 测试失败）
  - 每行格式正确（匹配同 TS-4.2 正则）
  - 整个测试 < 5 秒
- 通过标准：
  - `(await fs.readFile(path, "utf-8")).split("\n").filter(Boolean).length === 1000`
  - 测试耗时 < 5000ms
- 类型：integration
- 备注：必须在 `writer.close(runId)` 之后再读行数，确保 stream/buffer 已 flush

**TS-4.4 SessionStore 元数据更新 → atomic-write 保持 durability**

- 输入：先 `save(record)`（status=running），然后改 `record.status = "completed"` 再 `save(updated)`，期间 mock `fs.rename` 在第二次 save 时 throw
- 操作步骤：
  1. 第一次 `store.save(record)`（成功）
  2. 设置 `fs.rename` mock throw
  3. 第二次 `store.save(updated)` → 捕获 throw
  4. `store.load(session_id)` 读回
- 期望：
  - 第一次 save 文件存在
  - 第二次 save 抛错
  - `load(session_id)` 返回**第一次 save 的版本**（status=running，不是 completed）
- 通过标准：
  - 第二次 save 抛出错误（RegistryWriteError 或同款）
  - `loaded.status === "running"`（原子写保护原文件）
- 类型：unit

**TS-4.5 跨 run 累计 cost 字段正确累加**

- 输入：SessionRecord 含 `runs: [{ cost: 0.05 }, { cost: 0.07 }]`；初始 `total_cost_usd = 0`
- 操作步骤：
  1. 调 SessionManager 内的 cost 累加逻辑（如 closeRun / endSession）触发 2 次
  2. 读取 SessionRecord 的 `total_cost_usd`
- 期望：`total_cost_usd === 0.12`
- 通过标准：
  - `Math.abs(record.total_cost_usd - 0.12) < 1e-9`（浮点容差）
- 类型：unit

**TS-4.6 启动期扫描 status=running session → 恢复策略**

⏸ **Phase B / Phase C 决议中**

PM 5/9 14:00 决定：Phase B 仅交付 SessionStore 读写 surface，**不实现** reconciliation 逻辑。具体策略（继续 stream / 标 cancelled / 标 failed）由 Phase C 或 S4（Review Engine）决议。

QA 当前不补全本场景通过标准。`test-strategy-s3.md` 在 Phase B 实施期间不接受本场景作为 acceptance 项。

---

### §3.5 Task Scheduler chokidar inbox（Phase C 范围）

> **本节场景在 Phase C 实施期间会被填实**。以下为 QA 提前规划的场景轮廓。

**TS-5.1 chokidar watch 触发 → scheduler 读取并 dispatch**
- 输入：向 inbox 目录投入 1 个合法 `TASK-*.md` 文件
- 操作：等待 chokidar 触发 + scheduler dispatch
- 期望：TaskScheduler 内部接收该文件 + 按 front-matter 的 priority 分配到对应 agent queue
- 类型：integration（Phase C 待补全）

**TS-5.2 Task front-matter 不合 §3.3 Task Schema → 产生 reject 文件**
- 输入：front-matter 缺少必要字段（如 `recipient`）的 TASK-*.md
- 操作：投入 inbox
- 期望：scheduler 写出 `<原文件名>.reject.md`（含 reject 原因）；**不进入 dispatch 队列**
- 备注：`.reject.md` 的 schema 和路径约定待 Phase C 派单时由 PM 敲定，QA 在此列出为待 TBD
- 类型：integration（Phase C 待补全）

**TS-5.3 state_history 自动追加 — status 变化记录**
- 输入：AgentRecord 经历 idle → running → error 三次 status 变化
- 操作：三次 markFailed / register / resume 触发不同状态
- 期望：`agents.json` 里该 record 的 `state_history[]` 数组追加 3 条（不删旧的）；每条含 `at` + `status`
- 备注：`state_history` 字段是否在 `@codeflow/protocol` 还是 runtime 私有类型，待 FCoP Issue #2 反馈后确认
- 类型：unit（Phase C 待补全）

**TS-5.4 大量 task 进入 inbox — 不丢失 + 按 priority 排序**
- 输入：50 个 TASK-*.md 同时投入 inbox（P0 / P1 / P2 / P3 混合）
- 操作：观察 scheduler dispatch 顺序
- 期望：全部 50 个任务被 scheduler 接收（无遗漏）；dispatch 顺序 P0 优先（同优先级 FIFO）
- 类型：integration（Phase C 待补全）

---

## §4 测试基础设施（QA 给 DEV 的建议）

### §4.1 测试框架推荐

| 选项 | 推荐度 | 理由 |
|---|---|---|
| **`node:test`**（Node 20+ 内置） | ⭐⭐⭐ **首选** | 零依赖、零配置；与 v0.1 "最简轻量" 哲学一致；Node 20 LTS 内置稳定 |
| `vitest` | ⭐⭐ 备选 | 如果 DEV 在 spike 阶段已用 vitest 且配置完善，可延续；但需额外依赖 |
| `jest` | ❌ 不推荐 | 过重；ESM 兼容性有坑；与 v0.1 轻量哲学冲突 |
| `mocha` | ❌ 不推荐 | 同 jest，过重 |

### §4.2 mock / spy 策略

- **推荐**：用 `InMemorySdkAdapter` 显式注入（依赖注入模式，不 monkey-patch 全局）
- **推荐**：`node:test` 内置 `mock.fn()` / `mock.method()` 实现 spy，无需 sinon
- **不推荐**：`jest.mock()` 类型全局 monkey-patch；`proxyquire` 类黑魔法

### §4.3 覆盖率门槛建议

| 维度 | 建议门槛 | 说明 |
|---|---|---|
| 行覆盖率（line coverage） | ≥ 80% | Phase A 末由 DEV 报告 |
| 分支覆盖率（branch coverage） | ≥ 70% | 尤其关注 atomic-write 的 3 个分支（正常/写失败/rename 失败）|
| 关键路径（reconciliation 三场景） | 100% | 三场景 X/Y/Z 全部必须有对应测试 |

### §4.4 CI 集成

- **本任务不配置 CI**，留待 Sprint S6（E2E 验收）统一接入
- DEV 在 Phase A 完成后以 `npm test` 本地跑通为验收门槛

### §4.5 Fixture 命名约定

QA 建议 DEV 在 `packages/codeflow-runtime/src/registry/__tests__/fixtures/` 按以下结构组织：

```
__tests__/fixtures/
├── valid-agents/            # 合法 AgentRecord，按 layer 分组
│   ├── worker-dev01.json
│   ├── worker-pm01.json
│   └── governance-review01.json
├── invalid-agents/          # 故意非法的 spec，用于 schema 校验测试
│   ├── missing-layer.json   # 缺 layer 字段 → TS-3.2
│   ├── admin-layer.json     # layer=admin → TS-3.3
│   └── missing-role.json    # 缺 role 字段
├── reconciliation/          # RuntimeBootstrap 三场景
│   ├── scenario-x-orphan/   # 本地 record 有，SDK list 空 → TS-2.3
│   ├── scenario-y-foreign/  # 本地空，SDK list 有 → TS-2.4
│   └── scenario-z-drift/    # 字段漂移（场景 Z，Phase A 占位）
└── corrupted-agents.json    # 破坏 JSON → TS-1.5
```

> DEV 如调整命名，请同步更新 §3 场景表中的 fixture 引用路径；QA acceptance 以实际路径为准。

---

## §5 Phase A 验收清单（QA 给 PM 的承诺）

将 `TASK-20260509-009-PM-to-DEV.md` §验收标准 11 项与本策略 §3 场景逐项对照：

| TASK-009 验收项 | 验证方式 | 对应 QA 场景 |
|---|---|---|
| **1** 包编译通过（`tsc --noEmit` 零报错） | `cd packages/codeflow-runtime && npx tsc --noEmit` | — （编译验收，非功能测试）|
| **2** `@codeflow/protocol` 包未受影响（`npm test` 全过） | `cd packages/codeflow-protocol && npm test` | — （回归验收）|
| **3** 单元测试 11 场景零失败（`npm test`） | `cd packages/codeflow-runtime && npm test` | TS-1.1~1.3 / TS-2.2~2.4 / TS-3.1~3.4 / TS-2.6~2.7 / TS-1.2 |
| **4** atomic-write 三步 grep 验证 | grep `writeFile(*.tmp)` → `rename` → `fsync` | TS-1.1 / TS-1.2 / TS-1.3 |
| **5** layer=admin 拒绝在 SDK 调用前完成 | spy 验证（测试场景 3） | **TS-3.3** |
| **6** RuntimeNotReady 防御 | 测试场景 11 | **TS-2.6** |
| **7** 协议依赖纪律 grep | `packages/codeflow-runtime/src` 不出现字段名重新声明 | **TS-0.2** |
| **8** ReadLints 零错误 | 对所有改动文件 | — （lint 检查，非功能测试）|
| **9** README 更新到 Phase A 完成态 | 第一句话含"Phase A 已实现" | — （文档验收）|
| **10** 不动 spike 文件夹 | `git diff _ignore/spike_sdk_doorbell/` 为空 | — （git 验收）|
| **11** 不动 `@codeflow/protocol` 包内 schema | `git diff packages/codeflow-protocol/schemas/` 为空 | — （git 验收）|

> Phase A acceptance 操作流程（QA 收到 DEV 回执后）：
> 1. 按 DEV 回执的自测结果逐项交叉核对上表
> 2. 重点手工验证 TS-3.3（spy 验证 SDK.create 未调用）和 TS-2.6（RuntimeNotReadyError）
> 3. 跑 `git diff packages/codeflow-protocol/schemas/ packages/codeflow-protocol/src/types.ts` 确认空
> 4. 跑 `git diff _ignore/spike_sdk_doorbell/` 确认空
> 5. 全部通过后写对应序号的 Phase A acceptance report

---

## §5b Phase B 验收清单（TASK-013 §验收标准 15 项 ↔ TS-x.x 对照）

将 `TASK-20260509-013-PM-to-DEV.md` §验收标准 15 项与本策略 §3 场景逐项对照，供 PM 在收到 DEV `REPORT-013` 后快速交叉验证：

| TASK-013 验收 # | 项 | 对应 QA 场景 | 备注 |
|---|---|---|---|
| **1** | 包编译通过（`tsc --noEmit` 零报错） | — （编译验收，非功能测试）| `cd packages/codeflow-runtime && npx tsc --noEmit` |
| **2** | `@codeflow/protocol` 包未受影响（`npm test` 仍 8/8） | — （回归验收）| `cd packages/codeflow-protocol && npm test` |
| **3** | Phase A 16 + Phase B 新增测试全过（≥ 25 tests / 0 fail） | Phase A：§3.1~§3.3 各场景；Phase B：**TS-4.1~TS-4.5** + **TS-2.8**（场景 12） | `cd packages/codeflow-runtime && npm test` |
| **4** | TS-2.8 patch 测试场景 12 命中（`assert.rejects(... RuntimeBootstrapError, /SDK.list\(\) failed/)`） | **TS-2.8**（已更新通过标准）| DEV TASK-013 §附加交付 2 实现；QA 在 §3.2 TS-2.8 中已写完整断言规格 |
| **5** | SessionStore atomic-write 模式正确（grep：`*.tmp + rename + fsync + win32 守护`） | **TS-4.4**（rename 中断保持原文件）| grep 验证 `SessionStore.ts` 含三步原子写 |
| **6** | TranscriptWriter append-only（grep：`appendFile` 或 `createWriteStream(flags:"a")`，无 overwrite） | **TS-4.2 / TS-4.3** | grep 验证 `TranscriptWriter.ts` 不含 `writeFile(path, ...)` 覆盖模式 |
| **7** | `cancelAllForEmergencyStop` 用 `Promise.allSettled`（grep 验证） | — （架构约束，非 QA 场景；grep 即可）| `grep "allSettled" packages/codeflow-runtime/src/session/SessionManager.ts` |
| **8** | 协议依赖纪律 grep（runtime/src 不重新声明 schema 字段名） | **TS-0.2** | 同 Phase A 验收 #7 |
| **9** | ReadLints 零错误（所有改动文件）| — （lint 检查）| 对 SessionManager / SessionStore / TranscriptWriter + 附加交付文件 |
| **10** | README 更新至 Phase B 完成态（SessionManager / SessionStore / TranscriptWriter 标 ✅）| — （文档验收）| `Select-String "SessionStore.*✅" packages/codeflow-runtime/README.md` |
| **11** | 不动 spike 文件夹（`git diff --stat _ignore/spike_sdk_doorbell/` 空）| — （git 验收）| 同 Phase A 验收 #10 |
| **12** | 不动 protocol schema 字段（`git diff --stat packages/codeflow-protocol/schemas/` 空）| — （git 验收）| 同 Phase A 验收 #11 |
| **13** | L2 §0.0 改动正确（`Select-String "ADMIN 5/9 13:51" docs/design/codeflow-v2-on-fcop-sdk.md` 命中）| — （文档验收）| 宪法第 3 句落档 |
| **14** | L2 §3.0 节存在（`Select-String "^### 3.0 设计哲学" docs/design/codeflow-v2-on-fcop-sdk.md` 命中）| — （文档验收）| 协作宇宙哲学落档 |
| **15** | L2 解读表追加成功（grep "协作宇宙" 命中 ≥ 2 处）| — （文档验收）| §0.0 + §3.0 各含 1 处 |

> Phase B acceptance 操作流程（QA 收到 DEV REPORT-013 后）：
> 1. 对照上表，按 DEV 回执的自测结果逐项交叉核对
> 2. 重点手工验证 TS-4.3（行数 === 1000，< 5s）和 TS-4.4（atomic-write durability）
> 3. 手工验证 TS-2.8（场景 12）：确认 RuntimeBootstrapError 抛出 + message 含规定字符串
> 4. 跑 `git diff packages/codeflow-protocol/` 确认空
> 5. 跑 `git diff _ignore/spike_sdk_doorbell/` 确认空
> 6. L2 验收 13/14/15 跑 grep 命令确认命中
> 7. 全部通过后写对应序号的 Phase B acceptance report 回 PM

> **Phase B 不含的 QA 场景**：TS-4.6（Phase C / S4 决议中），不在本轮 acceptance 检查范围。

---

## §6 字段归属判定与 FCoP 协调清单

> 标题已从"待 D:\FCoP 评审字段清单"改名——因为 PM-01 已对清单内 2 项作出正式判定（TASK-014 §一，PM 5/9 14:00 回告）。

| 编号 | 字段 / 议题 | 状态 | 处置 |
|---|---|---|---|
| **FCoP-QA-01** | `state_history` 字段归属 | ✅ **已确认 = 协议层** | 已在 `packages/codeflow-protocol/schemas/task.schema.json` 等 4 处定义；**不进** FCoP Issue #2；Phase C Task Scheduler 消费时直接使用现有字段 |
| **FCoP-QA-02** | TS-2.8 SDK.list 超时归属 | ✅ **已确认 = runtime 工程层** | DEV 在 Phase B 附加交付 2 中已 patch `RuntimeBootstrap.ts` 翻译为 `RuntimeBootstrapError`；**不进** FCoP 提案 |

**v0.2 备忘**（placeholder，不在 S3 范围）：
- 当 Mobile Console 启动后，runtime-level `RuntimeBootstrapError` 可能需要事件化，由 runtime 推送到 Mobile 的"Audit"屏。届时是否需要新增 FCoP event schema，由 v0.2 sprint 决议。

---

*QA-01 起草。与 DEV Phase A 并行落盘。如 DEV 实施期间方法签名或接口有变更，请 PM 协调 QA 同步更新本文件对应场景。*
