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

**TS-2.8 SDK.list() 完全失败（超时/网络错误）→ 边界行为 [TBD]**
- 输入：SDK.list() throw "timeout"
- 操作：`bootstrap.run()`
- 期望：**当前为 TBD**——此场景下应全部 records 标 failed，还是整个 bootstrap HARD FAIL？
  - 候选 A：全部 records 标 failed（符合"单 record 失败不阻断"原则，但 SDK.list 失败影响的是全部 records）
  - 候选 B：HARD FAIL + process.exit(1)（符合"不允许半启动状态"，但启动全中断体验差）
- **QA 请求 PM 协调 DEV 在 Phase A 实施期间敲定此策略**，敲定后更新本条场景并补充通过标准
- 类型：unit（待补全）

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

> **本节场景在 Phase B 实施期间会被填实**。以下为 QA 提前规划的场景轮廓；Phase B 启动时 QA 会补充完整的"输入/期望/通过标准"。

**TS-4.1 SessionStore 单 record per file**
- 输入：1 个 SessionRecord（session_id, agent_id, status=running）
- 操作：SessionStore.save(record)
- 期望：`.codeflow/state/sessions/<session_id>.json` 文件存在，内容等效 record
- 类型：unit（Phase B 待补全）

**TS-4.2 TranscriptWriter append-only — 单事件追加**
- 输入：1 个 RuntimeEvent（turn, content="hello"）
- 操作：`transcriptWriter.append(runId, event)`
- 期望：`.codeflow/state/transcripts/<run_id>.md` 文件存在且末尾含 event 格式化输出；不做 atomic-rename（append-only 无需）
- 类型：unit（Phase B 待补全）

**TS-4.3 TranscriptWriter 高频事件流 — 不丢事件**
- 输入：1000 个连续 RuntimeEvent，逐一 `append()`
- 操作：串行 append 1000 次
- 期望：transcript 文件行数与事件数一致（按 line-based 校验，每事件占固定行）
- 类型：integration（Phase B 待补全）

**TS-4.4 SessionStore 元数据更新 → atomic-write**
- 输入：SessionRecord status=running → 调 SessionStore.update(session_id, { status: "completed" })
- 期望：文件内容更新；原子写（write-temp + rename）
- 类型：unit（Phase B 待补全）

**TS-4.5 跨 run 累计 cost 字段正确累加**
- 输入：Session 含 2 个 Run，各贡献 `cost_usd`；SessionManager.closeRun 调用
- 期望：`session.total_cost_usd === run1.cost + run2.cost`
- 类型：unit（Phase B 待补全）

**TS-4.6 启动期扫描 status=running 的 session → 恢复策略 [TBD]**
- 输入：`.codeflow/state/sessions/` 有 1 个 status=running 的 session（上次崩溃遗留）
- 操作：RuntimeBootstrap.run()（Phase B 扩展）
- 期望：**恢复策略 TBD**——继续 stream / 标 cancelled / 标 failed 哪种优先？
- **QA 请求 PM 在 Phase B 派单时明确此策略，届时补全通过标准**
- 类型：integration（Phase B 待补全）

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
> 5. 全部通过后写 `REPORT-020-QA-to-PM`（或对应序号的 Phase A acceptance report）

---

## §6 待 D:\FCoP 评审字段清单

> 按 §8.0 硬规则 #4：QA 发现的 schema 歧义 / 缺字段 / 命名不一致**不允许**在本仓修复，统一列在此处，由 PM 合并到上游 FCoP Issue #2 提案。

### 现阶段发现

**FCoP-QA-01：`state_history` 字段归属待确认**

- 场景来源：TS-5.3（Task Scheduler 状态变化追加）
- 问题描述：`state_history[]` 数组（记录 AgentRecord 状态变化历史）应定义在 `@codeflow/protocol` 的 Agent Schema（协议层，跨实现可见）？还是 `types/state.ts` 的 runtime 私有类型（仅本 runtime 实现持久化）？
- 影响：若属协议层 → 需 FCoP Issue #2 新增字段，等上游 maintainer 批准；若属 runtime 私有 → Phase C 可直接在 `types/state.ts` 添加，无需等待
- 建议：QA 倾向「runtime 私有」——状态历史是 runtime 治理诊断信息，不是 agent 的协议身份属性；但需 PM 与 DEV 确认后录入

**FCoP-QA-02：TS-2.8 SDK.list 超时的全局策略未在 crash-recovery.md 涉及**

- 场景来源：TS-2.8（SDK.list 完全失败）
- 问题描述：当 SDK.list() 本身失败时，crash-recovery.md 决策 2 只写了"单 record 失败不阻断启动"，但 SDK.list 失败属于"全局失败"而非"单 record 失败"，策略未被 4 决策覆盖
- 建议：在 Phase A 实施期间由 PM 推动 DEV 补充 crash-recovery.md 相关段落，或在 Phase A DEV 回执里作为"关键决策记录"纳入
- 与 FCoP 的关系：此问题属 runtime 工程层判断，无需上游协议变更；但如 v0.2 加 Mobile 告警，可能需要 FCoP 新增"bootstrap_failed" event schema

> 暂无 schema 字段层面的缺口（`agent_id`, `layer`, `sdk_agent_id`, `status`, `runtime_failure` 等均已在 §3 五类 schema 中定义）。

---

*QA-01 起草。与 DEV Phase A 并行落盘。如 DEV 实施期间方法签名或接口有变更，请 PM 协调 QA 同步更新本文件对应场景。*
