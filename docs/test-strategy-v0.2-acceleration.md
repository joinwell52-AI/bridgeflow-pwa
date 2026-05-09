---
protocol: fcop
version: 1
kind: test-strategy
doc_id: QA-STRATEGY-v0.2-ACCELERATION
author: QA-01
created: 2026-05-10
references:
  - TASK-20260510-004-PM-to-QA
  - TASK-20260510-002-PM-to-DEV
  - REPORT-20260510-002-PM-to-ADMIN
  - docs/test-strategy-s3.md
layer: qa
---

# CodeFlow v0.2 加速冲刺 QA 验收策略

## §0 背景与目标

ADMIN 于 2026-05-10 确认加速冲刺计划，目标：
- **v0.2.0-alpha**（P1，5/11 EOD）：Cursor SDK 真实接入 + ConfigLoader
- **v0.2.0-beta** （P2，5/12 EOD）：EXE 双模打包
- **v0.2.0-rc.1** （P3，5/14 EOD）：relay-bridge MVP
- **v1.0-rc.1**  （P4，5/22 EOD）：7 schemas + Boundary 强约束

QA-01 提前准备验收检查清单与 fixture，DEV 每阶段交付后即可快速拼接验收。

---

## §1 验收总原则

| 原则 | 说明 |
|---|---|
| 文件协议 | 每次验收结果写 `REPORT-YYYYMMDD-XXX-QA-to-PM.md`，不口头报告 |
| 无阻塞上线 | P0 bug 不修复不进入下一阶段 |
| 回归范围 | 每版本必须包含 v0.1.0-rc.1 基线 94/94 回归 |
| Fixture 优先 | 使用 `codeflow-shell/examples/` 标准 fixture，不临时造数据 |
| 已知偏差 | DEV Surprise 1（SEA EXE 备选）、Surprise 2（Windows 非交互 SIGINT），可持续 |

---

## §2 v0.1.0-rc.1 基线回归（每版本必跑）

> 来源：`test-strategy-s3.md §9`，历史结论：94/94 PASS，0 flaky

| 编号 | 检查项 | 期望结果 | 权重 |
|---|---|---|---|
| BL-01 | `npm test`（在 `packages/codeflow-runtime/` 下） | 94/94 PASS，无 flaky | MUST |
| BL-02 | 所有 Phase A~E 子系统命名未变更 | 无 `ReferenceError` | MUST |
| BL-03 | `InboxWatcher` / `TaskParser` / `ReviewEngine` / `SkillRegistry` 四大核心路径正常 | 日志含各组件 OK 标记 | MUST |
| BL-04 | `NeedsHumanGate` 在 fake SDK 下正常触发（基线行为） | stdout 含 `[NeedsHumanGate]` | MUST |

验收结论：BL-01~04 全通 → 基线 ✅，否则 P0 阻塞。

---

## §3 v0.2.0-alpha 验收清单（Cursor SDK 真实接入）

DEV 交付：`sdk-factory.ts`、`config.ts`（ConfigLoader）、`.env.example`

### §3.1 无 API Key → fallback fake adapter

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| A-01 | 不设 `CURSOR_API_KEY`，启动 `npm start` | banner 显示 `adapter=fake` 或等价提示 | MUST |
| A-02 | 上述场景 drop `hello-world/sample-task.md` | 治理循环完整走完（fake verdict → needs_human） | MUST |
| A-03 | `CURSOR_API_KEY` 设为空字符串 `""` | 与无 key 行为一致（fallback fake） | SHOULD |

### §3.2 无效 API Key → 错误处理

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| A-04 | `CURSOR_API_KEY=invalid_key_xxxx` 启动 | 启动不 crash，适配器初始化失败后 fallback fake 或打印 ERROR 日志 | MUST |
| A-05 | 上述场景 drop 任务 | 治理循环不挂死；NeedsHumanGate 触发或错误日志明确 | MUST |
| A-06 | `CURSOR_API_KEY=invalid` + 无网络 | 进程不崩溃，10s 内有明确错误输出 | SHOULD |

### §3.3 有效 API Key → 真实 SDK 调用

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| A-07 | `CURSOR_API_KEY=<ADMIN 提供的真实 key>` 启动 | banner 显示 `adapter=cursor-sdk` 或等价提示 | MUST |
| A-08 | drop `real-sdk-smoke/sample-task-with-cursor-sdk.md` | SDK 被调用，stdout 含 VERDICT 行（approve / reject / needs_human 之一） | MUST |
| A-09 | 上述场景 verdict=approve 时 | 无 `[NeedsHumanGate]` 输出（approve 不触发人工介入） | SHOULD |
| A-10 | 上述场景 verdict=needs_human 时 | `[NeedsHumanGate]` 触发，review 文件写磁盘 | SHOULD |

### §3.4 ConfigLoader 优先级

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| A-11 | 同时设 `config.json` 和环境变量 | env var 覆盖 config.json（高优先级） | MUST |
| A-12 | `~/.codeflow/v2/config.json` 存在且有 `dataDir` | 进程使用该 dataDir | SHOULD |
| A-13 | `./codeflow.config.json`（项目根）存在 | 覆盖 `~/.codeflow/v2/config.json` 中同名字段 | SHOULD |
| A-14 | CLI arg `--api-key` 传入 | 覆盖所有下层 config 来源 | SHOULD |

### §3.5 v0.2.0-alpha 验收结论模板

```
基线回归：BL-01~04 [PASS/FAIL]
A-01~A-06 无 key / 无效 key：[X/6] PASS
A-07~A-10 真实 SDK：[X/4] PASS  （需 ADMIN 提供 key）
A-11~A-14 ConfigLoader：[X/4] PASS
已知偏差：
  - [列出任何与期望不符的行为]
建议：[进入 beta / 需修复 #N]
```

---

## §4 v0.2.0-beta 验收清单（EXE 双模打包）

DEV 交付：`SPIKE-EXE.md` + 可运行 EXE（或 `npm start` fallback 文档）

### §4.1 EXE 冷启动

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| B-01 | 双击 / 命令行运行 `CodeFlow-v0.2.0-beta.exe` | 3s 内出现版本 banner + paths 信息 | MUST |
| B-02 | EXE 无需 Node/npm 环境 | 在无 Node 机器上（或隔离 PATH）正常启动 | MUST |
| B-03 | 首次运行自动创建 `~/.codeflow/v2/` 目录 | 目录存在，skills 植入 | MUST |
| B-04 | EXE 文件大小 | 附上实际大小（无上限要求，记录在案） | INFO |

> 若 Node SEA 打包失败（Surprise 1 已知风险），`npm start` 为 fallback：
> B-01 改为：`npm start` 3s 内出现 banner；B-02 标注 "SEA 未实现，fallback 模式"。

### §4.2 治理循环（EXE 模式）

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| B-05 | EXE 运行中 drop `hello-world/sample-task.md` | 治理循环完整（InboxWatcher→ReviewEngine→NeedsHumanGate） | MUST |
| B-06 | review 文件写入 `~/.codeflow/v2/reviews/` | 文件存在且内容非空 | MUST |
| B-07 | EXE 路径含空格（如 `C:\My Apps\`） | 启动和 drop 任务均正常 | SHOULD |

### §4.3 优雅退出（EXE 模式）

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| B-08 | 交互式 Ctrl+C | 2s 内打印 "stopped cleanly. Goodbye." 并退出 | MUST |
| B-09 | `taskkill /F` 强杀 | 无孤儿进程残留（chokidar watcher 关闭） | SHOULD |

### §4.4 EXE baseline 性能

| 编号 | 指标 | 期望 | 优先级 |
|---|---|---|---|
| B-10 | 冷启动到 banner 时间 | ≤ 5s（记录实测值） | SHOULD |
| B-11 | drop task 到 NeedsHumanGate 时间 | ≤ 10s | SHOULD |

### §4.5 v0.2.0-beta 验收结论模板

```
基线回归：BL-01~04 [PASS/FAIL]
B-01~B-04 EXE 冷启动：[X/4]
B-05~B-07 治理循环：[X/3]
B-08~B-09 优雅退出：[X/2]
B-10~B-11 性能基线：[记录实测值]
SEA 模式：[实现 / fallback npm start]
建议：[进入 rc.1 / 需修复 #N]
```

---

## §5 v0.2.0-rc.1 验收清单（relay-bridge MVP）

DEV 交付：`relay-bridge.ts`（relay 客户端），能通过 relay 将 TASK 注入 inbox 并回传状态。

### §5.1 relay 连接 / 断开

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| R-01 | 启动时 `CODEFLOW_RELAY_URL` 已设 | stdout 含 relay connected 日志 | MUST |
| R-02 | 启动时未设 relay URL | 静默跳过（不 crash），standalone 模式正常 | MUST |
| R-03 | relay 断线（关闭服务端） | 自动重连或打印 WARN，进程不退出 | SHOULD |
| R-04 | `CODEFLOW_ROOM_KEY` 未设时的默认行为 | 有合理默认或拒绝连接并打印 ERROR | SHOULD |

### §5.2 PWA 模拟 → inbox 注入 TASK

> 使用 `codeflow-shell/examples/relay-bridge-smoke/wscat-payload-command.json` 作为发送负载

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| R-05 | wscat 发送 `wscat-payload-command.json` 到 relay | relay 转发给 codeflow-shell | MUST |
| R-06 | codeflow-shell 收到后写入 inbox task 文件 | `<dataDir>/inbox/` 下出现 `TASK-*.md` | MUST |
| R-07 | 治理循环正常启动（InboxWatcher 触发） | stdout 有 InboxWatcher 日志 | MUST |

### §5.3 task_event / agent_status 回传 PWA

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| R-08 | 治理循环推进时 | relay 收到 `task_event` 消息（wscat 终端可见） | MUST |
| R-09 | 治理循环中 agent 状态变化 | relay 收到 `agent_status` 消息 | SHOULD |
| R-10 | `expected-task-event.json` 中定义的字段均存在 | payload 结构符合 v2 schema | MUST |

### §5.4 手机模拟 → relay → SDK → 治理 → reply_summary 回手机

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| R-11 | wscat 模拟手机发送 TASK | relay 接收并转发 CodeFlow | MUST |
| R-12 | 治理完成后 relay 回送 `reply_summary` | wscat 终端收到含摘要的消息 | SHOULD |
| R-13 | `reply_summary` 含 `task_id` 和 `decision` 字段 | 结构正确，不为空 | SHOULD |

### §5.5 v0.2.0-rc.1 验收结论模板

```
基线回归：BL-01~04 [PASS/FAIL]
R-01~R-04 relay 连接：[X/4]
R-05~R-07 PWA→inbox 注入：[X/3]
R-08~R-10 task_event 回传：[X/3]
R-11~R-13 手机模拟→reply_summary：[X/3]
relay 测试地址：[wss://...]
建议：[进入 v1.0-rc.1 sprint / 需修复 #N]
```

---

## §6 v1.0-rc.1 验收清单（7 schemas + Boundary 强约束）

DEV 交付：7 个 schema（boundary/encoding/ipc/event/failure + 2 个），Boundary 强约束，NeedsHumanGate → BOUNDARY_VIOLATED 路径。

### §6.1 7 schemas 验证

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| S-01 | 合法 task 文件通过 schema validate | 无校验错误 | MUST |
| S-02 | 缺少必填字段的 task 文件 | 抛出 `SchemaValidationError` 或等价错误 | MUST |
| S-03 | 额外未知字段 | 宽容模式：忽略；或严格模式：报错（取决于实现，记录实际行为） | INFO |
| S-04 | boundary schema 合法载荷 | validate 通过 | MUST |
| S-05 | encoding schema 合法载荷 | validate 通过 | MUST |
| S-06 | ipc schema 合法载荷 | validate 通过 | MUST |
| S-07 | event schema 合法载荷 | validate 通过 | MUST |

### §6.2 5 schemas 向后兼容（v0.1 → v1.0）

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| S-08 | v0.1 格式的 `TASK-*.md`（只有基础字段） | v1.0 schema 仍可 validate 通过 | MUST |
| S-09 | v0.1 格式的 `REVIEW-*.md` | v1.0 schema validate 通过或优雅降级 | MUST |
| S-10 | v0.1 格式的 session / transcript 文件 | 不报 SchemaValidationError（向后兼容） | MUST |
| S-11 | v0.1 的 `agent_status` event 格式 | v1.0 event schema validate 通过 | SHOULD |
| S-12 | v0.1 的 `task_event` 格式 | v1.0 event schema validate 通过 | SHOULD |

### §6.3 boundary.can / cannot 强约束验证

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| S-13 | `boundary.can` 列出合法操作，调用合法操作 | 执行通过，无 boundary 报错 | MUST |
| S-14 | `boundary.cannot` 列出禁止操作，调用禁止操作 | 抛出 `BoundaryViolationError` 或 `BOUNDARY_VIOLATED` | MUST |
| S-15 | drop `boundary-violation-smoke/sample-task-violating-boundary.md` | NeedsHumanGate 收到 `BOUNDARY_VIOLATED` reason，写入 review 文件 | MUST |
| S-16 | boundary 未定义时调用任意操作 | 不 crash，有合理默认（allow-all 或 deny-all，取决于实现，记录） | SHOULD |

### §6.4 NeedsHumanGate → BOUNDARY_VIOLATED 完整路径

| 编号 | 步骤 | 期望 | 优先级 |
|---|---|---|---|
| S-17 | drop 触发 boundary 违规的 task | 治理循环不崩溃，NeedsHumanGate 正确触发 | MUST |
| S-18 | review 文件包含 `BOUNDARY_VIOLATED` 关键字 | 可追溯 | MUST |
| S-19 | relay 在线时，`BOUNDARY_VIOLATED` 事件通过 relay 回传 | wscat 收到含 `boundary_violated` 的消息 | SHOULD |

### §6.5 v1.0-rc.1 验收结论模板

```
基线回归：BL-01~04 [PASS/FAIL]
S-01~S-07 7 schemas 验证：[X/7]
S-08~S-12 v0.1→v1.0 向后兼容：[X/5]
S-13~S-16 boundary.can/cannot：[X/4]
S-17~S-19 BOUNDARY_VIOLATED 路径：[X/3]
建议：[v1.0 GA 候选 / 需修复 #N]
```

---

## §7 跨版本回归矩阵

当 v1.0-rc.1 完成时，执行如下矩阵快速核查：

| 检查项 | v0.1.0-rc.1 | v0.2.0-alpha | v0.2.0-beta | v0.2.0-rc.1 | v1.0-rc.1 |
|---|---|---|---|---|---|
| 94/94 unit tests PASS | ✅（已验） | 待验 | 待验 | 待验 | 待验 |
| hello-world governance loop | ✅（已验） | 待验 | 待验 | 待验 | 待验 |
| NeedsHumanGate 触发 | ✅（已验） | 待验 | 待验 | 待验 | 待验 |
| relay-bridge（R-05~R-10） | N/A | N/A | N/A | 待验 | 待验 |
| boundary 强约束（S-13~S-19） | N/A | N/A | N/A | N/A | 待验 |

---

## §8 Bug 报告规范（本冲刺期间）

```
REPORT-YYYYMMDD-XXX-QA-to-PM.md
```

Bug 描述必须包含：
- `severity`：P0（崩溃/阻塞）/ P1（功能错误）/ P2（体验问题）
- `version`：在哪个版本发现
- `steps`：最小复现步骤
- `expected` / `actual`
- `regression`：是否影响 v0.1 基线

---

## §9 变更历史

| 日期 | 版本 | 变更人 | 说明 |
|---|---|---|---|
| 2026-05-10 | 1.0 | QA-01 | 初版，覆盖 v0.2 alpha/beta/rc.1/v1.0-rc.1 四阶段 |
