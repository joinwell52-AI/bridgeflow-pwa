---
protocol: fcop
version: 1
kind: report
task_id: REPORT-20260509-002
sender: DEV
recipient: PM
priority: P1
thread_key: codeflow-v2-sprint-s2-agent-registry-session-manager
references:
  - TASK-20260509-002-PM-to-DEV
  - REPORT-20260509-001-DEV-to-PM
layer: worker
---

# Sprint S2 完成：Agent Registry + Session Manager 设计骨架已落地

## 一句话结论

按 TASK-002 的 5 项必交付 + 8 条不做清单 + 8 项验收标准，Sprint S2 全部交齐。期间发现 **0 个新的 schema 缺口**——v2 设计文档 §3 写出来的字段已经完全够 S2 接口骨架用，不需要追加 D:\FCoP 提案。

## 二、影响范围（按 DEV-01 规则）

### 修改的文件

| 区域 | 改动 | 说明 |
|---|---|---|
| `packages/codeflow-protocol/src/types.ts` | **新增** | 5 schema 的 1:1 TS 类型镜像（手写，~280 行）。这是 *协议层 TS API 扩展*，不是 schema 字段扩展，按 §8.0 硬规则 #4 合法 |
| `packages/codeflow-protocol/src/index.ts` | 修改 | 导出 25 个 schema 类型 + 已有的 validator API |
| `packages/codeflow-runtime/` | **新增整个包** | 见下方目录树 |
| `docs/agents/tasks/REPORT-20260509-002-DEV-to-PM.md` | 新增 | 本文件 |

### 新增包目录树

```
packages/codeflow-runtime/
├── package.json                             (@codeflow/runtime, deps: @codeflow/protocol via file:)
├── tsconfig.json                            (paths 别名指向 ../codeflow-protocol/src/index.ts)
├── README.md                                (S2 scope 声明 + 协议依赖纪律)
├── .gitignore
├── src/
│   ├── index.ts                             (公开 API barrel, 12 个导出)
│   ├── registry/
│   │   ├── AgentRegistry.ts                 (6 方法 + JSDoc + throw not-implemented)
│   │   ├── PersistentStore.ts               (interface + factory)
│   │   └── index.ts
│   ├── session/
│   │   ├── SessionManager.ts                (6 方法 + JSDoc + throw not-implemented)
│   │   ├── RunHandle.ts                     (re-export from types/state.ts)
│   │   └── index.ts
│   └── types/
│       └── state.ts                         (AgentRecord / SessionRecord / RunHandle / RuntimeEvent)
├── fixtures/
│   ├── agents.json                          (3 agent 样例: PM-01 worker / DEV-01 worker / QA-01 governance)
│   └── sessions/
│       └── valid-runtime-session-001.json
└── docs/
    └── crash-recovery.md                    (4 决策完整论证, ~230 行)
```

### 是否影响已有功能

- **`@codeflow/protocol` 包**：tsc 通过、`npm test` 通过（5 valid + 3 invalid fixtures 全部如预期），新增的 `types.ts` 与 `validator.ts` 完全解耦，没有破坏 ajv 编译路径。
- **其他子项目**：本 sprint 的所有改动局限于 `packages/` 目录；`codeflow-desktop/` / `codeflow-plugin/` / `web/pwa/` / `server/relay/` 一行未动。

### 是否需要重启服务

**不需要**——本 sprint 是设计骨架，无服务/生产部署。

## 三、自测结果

| 检查 | 结果 |
|---|---|
| `packages/codeflow-protocol`: `tsc --noEmit` | ✅ 0 报错 |
| `packages/codeflow-protocol`: `npm test`（5 valid + 3 invalid fixtures） | ✅ 全部如预期 |
| `packages/codeflow-runtime`: `npm install`（首次安装 file: 依赖） | ✅ 4.2s，0 报错 |
| `packages/codeflow-runtime`: `npx tsc --noEmit` | ✅ 0 报错（`strict: true` + `noUncheckedIndexedAccess: true`） |
| `ReadLints packages/codeflow-protocol/` | ✅ 0 错误 |
| `ReadLints packages/codeflow-runtime/` | ✅ 0 错误 |
| 协议依赖纪律 grep（`packages/codeflow-runtime/src` 不应出现 schema 字段名重新声明） | ✅ 通过——`agent_id` / `layer` / `risk_level` / `decision` 等只在 `import type ... from "@codeflow/protocol"` 上下文出现 |
| 接口 method JSDoc 完整性（每方法含：用途/入参/返回/不变量/异常） | ✅ AgentRegistry 6 方法 + SessionManager 6 方法全部含完整 4 段 |
| README 第一句明示 sprint scope | ✅ "本包当前为 Sprint S2 设计骨架，方法体未实现……" |
| `crash-recovery.md` 4 问答完整 | ✅ 每问 ≥ 30 行论证 + 1 个明确推荐 + S3 关键交付清单 |

### 一处主动选择：禁用 unused-private-field 视觉警告的工程取舍

`AgentRegistry._store` 与 `SessionManager._opts` 在 S2 阶段 *未被任何 method 使用*（method 全部 throw not-implemented）。两种处理方式：

- **方案 A**：用 `void this._store;` 在每个 method 里假装"使用"——视觉污染严重
- **方案 B**：私有字段加下划线前缀（TS / ESLint 默认惯例标识"刻意未用"）+ 在每个 method body 里用 `void` 标记入参——已采用

按方案 B 实施。S3 实现时 `_store` / `_opts` 的下划线前缀必须**去掉**，因为那时方法体真正消费它们了。这条已写在 `crash-recovery.md` 决策 1 的 S3 交付清单里。

## 四、待 D:\FCoP 评审字段清单 ⭐（按 TASK-002 §六 要求）

**0 个**。

理由：S2 接口骨架完全可以用 §3 已经写好的字段表达。具体复盘：

| Runtime 需求 | 用了 §3 哪个字段 | 是否新加？ |
|---|---|---|
| 标记 admin agent 不能 spawn | `Agent.layer === "admin"` | 无新加 |
| crash 后 resume | `Agent.sdk_agent_id` | 无新加 |
| Session 状态机 | `Session.status` + `Session.runs[].status` | 无新加 |
| Emergency Stop 标记 | `Session.status === "cancelled"` | 无新加（EMERGENCY-*.md 文件 schema 推迟到 v0.2 S10） |
| Run cancellation reason | 写到 `transcript_path` 文件，不进 schema | 无新加（按决策 4 拆分原则） |

### 但有 1 个 *运行时私有* 概念加到了 `types/state.ts`（不入协议）

| 类型 | 性质 | 为什么不入协议 |
|---|---|---|
| `RuntimeBindingMode = 'local' \| 'cloud'` | runtime 私有 | Agent.runtime 已经表达了"应该跑哪里"，但 *实际目前在哪* 是 runtime 实例的内部状态，不是协议契约 |
| `AgentFailure { failed_at, reason, cause? }` | runtime 私有 | 失败原因是 *runtime 诊断信息*，对其他 FCoP 实现无意义 |
| `RuntimeEvent + RuntimeEventType` | runtime 私有 | 8 SDK 事件类型 + 4 runtime 事件类型，是 *Cursor SDK 绑定层* 的产物，不是 FCoP 协议契约 |
| `SessionHandle / RunHandle` | runtime 私有 | 句柄抽象，是给 TS 调用方的 ergonomic 包装，不是持久化结构 |

这些都用 `runtime_` 前缀或纯运行时类型表达，与协议字段在视觉上完全分离——任何 reviewer 一眼能看出"这是 runtime 私有的，不应该被 D:\FCoP 接受"。**这正是 §8.0 硬规则 #4 想要的"clear boundary"**。

## 五、`crash-recovery.md` 4 个决策结论（按 TASK-002 §四 必交付 5）

| 决策 | 结论 | 推荐方案 |
|---|---|---|
| **1 写入时机** | 每次写操作后立刻 atomic-write + fsync | write-temp + rename + fsync(parent dir)；v0.1 量级（< 1000 写/天）下 fsync 开销 < 毫秒级 |
| **2 启动 resume 流程** | reconciliation 同步流程：`load → SDK.list → resume each → report` | `RuntimeBootstrap` + `ReconciliationReport`；单 record 失败不阻断启动，标 `failed` 即可 |
| **3 SDK 不一致** | **按 3 场景分流**，不一刀切 | 场景 X (本地多了) = 标 failed；场景 Y (SDK 多了) = 警告 + 不接管；场景 Z (漂移) = 以 SDK 为准 + 漂移记录 |
| **4 Session 持久化** | 元数据 JSON + 事件流 markdown 拆分 | `SessionStore` + `TranscriptWriter`；§3.5 schema 已经暗示了这个拆分（`runs[].transcript_path` 字段） |

详细论证 + S3 关键交付清单见 [`packages/codeflow-runtime/docs/crash-recovery.md`](../../packages/codeflow-runtime/docs/crash-recovery.md)。

**待 ADMIN 复议事项**：4 个决策都是工程层判断，不涉及协议层契约。如果 ADMIN review 后认为某个决策方向需要调整（譬如决策 4 倾向"全持久化"），请在新的 TASK-*-ADMIN-to-PM 里指出，DEV 会在 S3 启动前修订。**S3 启动前提 = 本文件被 PM/ADMIN review 完毕**。

## 六、与 TASK-002 不做清单（8 条）的对账

| 不做项 | 实际是否触碰 |
|---|---|
| ❌ 任何方法体的实现 | ✅ 没碰——所有 12 个方法都 `throw new Error("[S2 skeleton] ...")` |
| ❌ Skill Runtime / Task Scheduler / Review Engine | ✅ 没碰——按 README 列入 S3/S4/S5 |
| ❌ 实际调用 `Agent.create/resume` | ✅ 没碰——只在 JSDoc 里描述 S3 会怎么调 |
| ❌ 网络通信 / 中继层 / Mobile push | ✅ 没碰 |
| ❌ Cloud agent runtime 切换的实现 | ✅ 没碰——`updateRuntimeBinding` 接口签名留位 |
| ❌ E2E 测试 | ✅ 没碰——fixtures 是设计 review 样例，不是测试 |
| ❌ 在 `@codeflow/protocol` 之外创造 schema 字段 | ✅ 严守——见 §四 复盘 |

## 七、给 PM 的下一步建议

### 立刻可启动

- **Sprint S3：实现 AgentRegistry + Session Manager 的真实逻辑**——前提：本 REPORT 通过 ADMIN review 后启动；S3 关键交付清单已经写在 `crash-recovery.md` 4 个决策每个的末尾，PM 可以直接据此派单
- **D:\FCoP 5 字段提案推送**——TASK-003/004 决策已落档，等 ADMIN 在 `_ignore/fcop-issue-draft.md` 上拍最后一板（推/不推）

### 与本 sprint 无依赖、可并行

- v0.2 Mobile Governance MVP 的 sprint 拆解（§10.3 已列 S7-S10，但具体派单还没做）
- `_ignore/spike_sdk_doorbell/` 是否要从 `_ignore/` 升级到 `examples/` 或 `packages/codeflow-runtime/examples/`——SDK 验证 spike 已经稳定可用，作为参考实现升一层有教学价值

### 风险与未决项

| 项 | 状态 | 责任方 |
|---|---|---|
| crash-recovery.md 4 决策需 ADMIN review | pending | ADMIN |
| S3 启动需 ADMIN 给"开工"信号 | pending | ADMIN |
| `@codeflow/protocol` 的 5 字段（pending fcop review）状态保持不变 | active | PM 推送 D:\FCoP Issue 后追踪 |
| 一旦 D:\FCoP fcop@1.1 发版，本仓 protocol 包要镜像升级 | future | PM 那时再立单 |

---

DEV-01 待命。S2 全部交付物已就位，等 PM/ADMIN review 后决定是否启动 S3。
