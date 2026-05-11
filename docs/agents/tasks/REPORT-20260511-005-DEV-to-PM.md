---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260511-005
sender: DEV
recipient: PM
priority: P1
thread_key: codeflow-p4-pythonia-fcop-integration-spike
references:
  - TASK-20260511-005-PM-to-DEV
  - REPORT-20260511-001-PM-to-ADMIN
layer: worker
---

# REPORT-20260511-005：P4 调研 spike 完工 — pythonia 嵌 fcop 工程可行（D7=P 验证）

## 一、一句话结论

**pythonia viable ✅**：在 Windows + Node v24 + Python 3.12.9 上，4 个主交付 + 5 个独立探针**全部 PASS**，5 个核心 fcop@1.1.0 调用同进程延迟 1-7 ms / 调用（远低于 PM TASK §3.2 给的 < 50ms 阈值），Cold start 376 ms，warm re-import 0 ms，**P4 主 sprint 可以放心走 D7=P 路线**。

唯一非阻塞警示：**P4 工期 PM 给的 4-5 d 偏紧，DEV 视角估 ~7-8 工作日**（详见 §七）。

## 二、主交付 1 实测：`hello-fcop.ts`（pythonia + fcop 最小可执行）

### 输入

```typescript
import { python } from 'pythonia';
const fcop = await python('fcop');
console.log(`fcop version:`, await fcop.__version__);
await python.exit();
```

### 实测 stdout（关键行）

```
[hello-fcop] PYTHON_BIN env = C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe
[hello-fcop] await python('fcop') took 376 ms (cold start)
fcop version: 1.1.0
[hello-fcop] Python version = 3.12.9 (tags/v3.12.9:fdb8142, Feb  4 2025, 15:27:58) [MSC v.1942 64 bit (AMD64)]
[hello-fcop] Python exe     = C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe
[hello-fcop] second __version__ access took 0 ms (warm)
[hello-fcop] python.exit() returned; done
```

### 关键数字

| 维度 | 值 |
|---|---|
| Python 版本 | **3.12.9**（PM TASK §3.1 要求 3.10+，✅ 满足）|
| fcop 版本 | **1.1.0**（PM TASK §3.1 期望值精确匹配）|
| Cold start（`await python('fcop')`）| **376 ms** |
| Warm 属性访问 | **0 ms** |
| 需要的 env var | `PYTHON_BIN`（必须，见 §五 surprise 1）|

### 验证文件位置

`packages/codeflow-runtime/src/_spike/fcop-pythonia-spike/hello-fcop.ts`

## 三、主交付 2 实测：`demo-fcop-api.ts`（5 个核心调用 + 文件落盘）

### 实测 stdout（去除装饰行）

```
[demo] pythonia boot + import fcop took 204 ms
[demo] (1) fcop.Project(path, strict=False) → 1 ms
[demo] (1.5) project.init(team='dev-team') → 260 ms
[demo]     is_initialized = true | team = dev-team
[demo] (2) project.write_task(...) → 4 ms
[demo]     task.filename = TASK-20260511-001-PM-to-DEV.md
[demo]     task.task_id  = TASK-20260511-001
[demo] (3) project.list_tasks(status='open') → 2 ms
open tasks: 1
[demo] (4) project.write_review(...) → 7 ms
[demo]     review.filename  = REVIEW-20260511-001-QA-on-task-20260511-001.md
[demo]     review.review_id = REVIEW-20260511-001-QA-on-task-20260511-001
[demo]     review.decision  = <ReviewDecision.NEEDS_HUMAN: 'needs_human'>
[demo] (5) project.mark_human_approved(...) → 5 ms
[demo]     human_approval = approver=ADMIN decision=<HumanApprovalDecision.APPROVE: 'approve'> channel=<HumanApprovalChannel.CLI: 'cli'>
all 5 calls passed
[demo] summary: succeeded=true callsPassed=5/5
```

### 延迟矩阵 vs PM TASK §3.2 < 50 ms / 调用阈值

| # | 调用 | 实测 ms | < 50 ms ? |
|---|---|---:|---|
| 1 | `fcop.Project(path, strict=False)` | 1 | ✅ |
| 1.5 | `project.init(team='dev-team')` | 260 | ⚠️ 一次性，写 1.5 MB 模板（合理）|
| 2 | `project.write_task(...)` | 4 | ✅ |
| 3 | `project.list_tasks(status='open')` | 2 | ✅ |
| 4 | `project.write_review(...)` | 7 | ✅ |
| 5 | `project.mark_human_approved(...)` | 5 | ✅ |

**结论**：除一次性 `init` 写模板的 260 ms，所有 hot-path 调用 1-7 ms。同进程 pythonia 桥几乎零开销。

### 文件实际落盘

```
fcop/
├── fcop.json                                          # team config + skills[] + roles
├── LETTER-TO-ADMIN.md                                 # v1.1 welcome
├── issues/  log/  reports/
├── reviews/
│   └── REVIEW-20260511-001-QA-on-task-20260511-001.md   ✅
├── shared/
│   ├── roles/{DEV,OPS,PM,QA}.{md,en.md}              # v1.1 deploy_role_templates 默认 True
│   ├── TEAM-OPERATING-RULES.{md,en.md}
│   ├── TEAM-README.{md,en.md}
│   └── TEAM-ROLES.{md,en.md}
└── tasks/
    └── TASK-20260511-001-PM-to-DEV.md                    ✅
workspace/
└── README.md                                          # v1.1 workspace_dir 拆分
```

### 验证文件位置

`packages/codeflow-runtime/src/_spike/fcop-pythonia-spike/demo-fcop-api.ts`

## 四、主交付 3：fcop@1.1.0 8 schemas vs CodeFlow v0.1 5 schemas 字段映射表

完整映射表 → **[`docs/internal/p4-schema-mapping-v1.1.md`](../../internal/p4-schema-mapping-v1.1.md)**（已落盘，174 行）。

### 关键发现（仅极简摘要，详见 internal 文档）

| 关系 | schema 数 | 备注 |
|---|---:|---|
| 直接一对一可替换 | 1 | `review`（CF 已设计成 FCoP-compatible）|
| 同名但语义错配 | 2 | `agent`（CF=PCB 实例 vs fcop=角色定义）、`skill`（CF 丰富 vs fcop 极简）|
| fcop 独有 | 5 | `boundary / encoding / event / failure / ipc-envelope` |
| CodeFlow 独有 | 1 | `session`（**fcop 故意没有**，runtime 内部）|
| task 关系 | — | CF `task` = fcop `ipc-envelope.payload.type=TASK` 的特化 |

**P4 主 sprint 第 1 天必解决的命名风险**：`agent.schema` 同名异义 —— 推荐 CodeFlow 内部已经叫 `AgentRecord`（见 `state.ts` line 68），文档统一术语即可。

## 五、主交付 4：8 类 surprise 揭示（按 PM TASK §3.4 列表 + DEV 自由补充）

### S1：pnpm 不存在（PM TASK §3.1 给的命令踩坑）

PM TASK §3.1 写 `pnpm add -D pythonia`，系统 PATH 上**只有 npm@7.19.0** 没装 pnpm。
- **DEV 处置**：用 `npm install`，效果等价。spike 子项目 `package.json` 自给自足，不污染主 workspace。
- **PM 备注**：TASK-006 文案统一改成「pnpm 或 npm」，或先 `npm i -g pnpm`。

### S2：Windows PATH `python` ≠ 装了 fcop 的 Python

```
PATH `python` → C:\...\Python39\python.exe  (3.9.5, no fcop)
PATH `python3`→ also 3.9.13 (no fcop)
py -3       → C:\...\Python312\python.exe (3.12.9, fcop 1.1.0 editable from D:\FCoP) ✅
```

pythonia v1.2.6 内部（`node_modules/pythonia/src/pythonia/StdioCom.js:16`）：

```js
this.proc = cp.spawn(process.env.PYTHON_BIN || 'python3', args, { stdio })
// fallback 到 'python' if ENOENT
```

- **DEV 处置**：每个 spike 跑命令前 `$env:PYTHON_BIN = "C:\...\Python312\python.exe"`，否则 fcop import 失败。
- **PM 备注 — P4 主 sprint**：runtime 集成 pythonia 时**必须**：
  1. 在 banner 中显示要 spawn 的 python.exe 路径（让用户能看见配错的情况）；
  2. 在 codeflow-shell 启动时**显式检查** `import fcop` 是否成功，否则报清晰错误并指引 `PYTHON_BIN` 配置（类比 `CURSOR_DEFAULT_MODEL` 的 banner WARNING）；
  3. `.env.example` 加 `PYTHON_BIN=` 注释项。

### S3：pythonia kwarg 语法陷阱（PM TASK §3.2 给的代码示例错了）

PM TASK §3.2 demo 代码：

```typescript
await fcop.Project('D:/temp/...', { strict$: false });           // ❌
await project.write_task('PM', 'DEV', 'spike test', 'just a test', { priority$: 'P0' }); // ❌
```

实际 pythonia v1.2.6 README（line 59）规则：「函数名后加 `$`，**最后一个参数整体**当作 kwarg dict，dict 内 key **不**带 `$`」：

```typescript
await fcop.Project$(path, { strict: false });                              // ✅
await project.write_task$({ sender: 'PM', recipient: 'DEV', priority: 'P0', subject: '...', body: '...' });  // ✅
```

PM 写法跑出来的报错很迷惑：

```
Python Error: Project.__init__() takes 2 positional arguments but 3 were given
```

- **DEV 处置**：所有 spike demo 代码用正确语法，并在 demo-fcop-api.ts 头注释中明确记录 PM 文案的错。
- **PM 备注**：TASK-006 文案修正后再发；或者放飞 DEV 自己调对，不卡在文案。
- **是否给 fcop 提 issue**：**不**。这是 pythonia README 易错点，不是 fcop 问题。自约束 7 严格遵守。

### S4：PM TASK §3.2 demo 代码 5 处 API 误用（不仅是 kwarg）

| PM 写法 | 实际 fcop@1.1.0 API |
|---|---|
| 写 demo 时漏了 `project.init()` | 必须先 init 才能 write_task |
| `write_task` 位置参数 | 全 kwarg-only |
| 把返回值当 filename 字符串 | 实际返回 `Task` / `Review` 对象，需取 `.filename` / `.review_id` |
| `mark_human_approved(reviewFilename.replace('.md',''))` | 应传 `review.review_id`（独立字段，更稳）|
| `ProjectStatus.initialized` | 实际字段名 `is_initialized` |

- **DEV 处置**：demo-fcop-api.ts 中按实际 API 调，每个修正点在注释里指出 PM 文案差异。
- **PM 备注**：以后用 fcop API 的 demo 文案先用 `py -3 -c "import inspect, fcop; print(inspect.signature(...))"` 核对。

### S5：Windows 路径含空格 PASS（不踩坑）

probe-surprises.ts P1：`Project()` + `init()` 在 `C:\...\Temp\spike with space ycGdea\` 上 PASS（init 291 ms，与无空格路径无差异）。**Windows 路径不需要 escape**。

### S6：concurrent write_task 在 GIL+pythonia 下 sequence 不冲突 ✅

probe-surprises.ts P2：5 个 `Promise.all([write_task, ...])` 并发：
```
5 parallel write_task: 18 ms total (avg 3.6 ms/call)
filenames produced: 5 (unique: 5)  ← 序号 1,2,3,4,5 全 unique
```

- **观察**：pythonia 通过 stdio 与 Python 端通信，**自动串行化**所有跨边界调用（GIL 也帮忙），所以并发 write_task 实际上在 Python 端是排队的 — 不会触发文件名冲突。
- **PM 备注 — P4 主 sprint**：runtime 任何并发场景（多 agent 同时写 task）都安全。但**反过来**，这也意味着**没有真并发**：5 调用 = 18 ms 串行，单调用 = 4 ms，5 调用并发并未减半时间。pythonia 不是 perf 优化方案，是简化方案。

### S7：fcop_mcp NOT auto-imported ✅（runtime 启动开销可控）

probe-surprises.ts P3：

```
sys.modules has 'fcop' = true
sys.modules has 'fcop_mcp' = false
```

PM TASK §3.4 担心的「fcop_mcp 是否会被一起 import 拖累启动」**不会发生**。fcop@1.1.0 是纯 library，fcop_mcp 是独立的 MCP server 包（仅 `Requires: jsonschema, pyyaml` + 不引用 fcop_mcp）。runtime 调 `python('fcop')` 不会 boot MCP server。

### S8：`workspace_dir="docs/agents"` escape hatch PASS（D6 决策可推迟）

probe-surprises.ts P4：

```
workspace_dir = WindowsPath('.../docs/agents')
workspace_layout = explicit
task.path = WindowsPath('.../docs/agents/tasks/TASK-20260511-001-PM-to-DEV.md')
```

PM TASK §3.5 明令本调研「不重命名 / 不迁移到 fcop/tasks/」 → ✅ 通过 `workspace_dir` 参数完全可以维持 CodeFlow v0.x 的 `docs/agents/` layout，**P4 主 sprint 可以不动 D6**（让 D6 推迟到 P5+ 再讨论）。

### S9：pythonia v1.2.6 没有 `python.builtins` shortcut

我一开始按直觉写 `await python.builtins.len(list)` 报 `Cannot read 'len' of undefined`。正解：`const builtins = await python('builtins'); await builtins.len(list)`。

- **PM 备注**：pythonia README 第 59 行的 tkinter 例子用 `tk.Label$()` 暗示存在简写，但 `python.builtins` 不是。文档需要更全。这是 pythonia 问题不是 fcop 问题，仍**不向 fcop / pythonia 提 issue**（自约束 7 + 不主动外发）。

### S10：pythonia 返回 enum 是 `<EnumName.VALUE: 'value'>` repr 形式

```
review.decision = <ReviewDecision.NEEDS_HUMAN: 'needs_human'>
```

直接 `console.log` 显示 enum repr。要拿字符串值要 `await enum.value`。
- **PM 备注 — P4 主 sprint**：runtime 用 fcop decision 时记得 `.value` 拿字符串再做条件判断。

### S11：fcop 同进程没有自带文件锁（但 pythonia 串行化保护了 sequence）

fcop 当前在 Python 单进程内**没有显式 file lock**（看了 `fcop/project.py` 源码片段，sequence 生成是「读 dir → 数 max+1 → 写」，不是 atomic）。但因 pythonia 跨边界自动串行化 → 单 runtime 进程内**完全安全**。

- **多 runtime 进程**场景（如 codeflow-shell 1 + codeflow-shell 2 同时写同一 `fcop/tasks/`）**理论上可能 race**，但本调研 PM TASK §3.5 不要求测多进程，记为 P5 检验项。

### S12：fcop init 默认 layout = `fcop/`，不是 CodeFlow 当前的 `docs/agents/`

详见 §三 文件落盘截图。**ADR-0022 提供 escape hatch**（`workspace_dir="docs/agents"`，见 S8）。D6 决策点尚未拍板。

## 六、PM 应在 TASK-006 主 P4 sprint 中注意的事项（DEV 视角风险）

排优先级：

1. **P0：`PYTHON_BIN` env var 必填**。runtime 集成 pythonia 后，codeflow-shell 启动 banner **必须**显式打印 spawn 的 python.exe 路径，并在 `import fcop` 失败时给清晰错误。否则用户像 BUG-SDK-001 一样卡在「不知道哪里出错」。
2. **P0：fcop API 签名以源码为准，不要照搬 §3.2 文案**。每个调用前 `inspect.signature()` 核对。
3. **P1：D6 layout 决策推迟（推荐）**。维持 `docs/agents/`（通过 `workspace_dir`），P5+ 再切换 — 减少 P4 风险面。
4. **P1：fcop `version` + `type` 字段**。fcop:review/ipc-envelope required `version` + `type` 字段比 CF schema 多，但 `Project.write_*` 会自动塞，**runtime 无须手填**。
5. **P1：跨进程并发未测**。多 codeflow-shell 同时写同一 fcop project 的 race condition 未在本 spike 验证。P4 限制到「单 runtime 进程」即可，P5 再扩多进程。
6. **P2：`Project.init()` 副作用大**。会创建 `shared/roles/*.md` + `TEAM-*.md` 等 12+ 文件。如果 CodeFlow 已经在 docs/agents/ 有自己的 roles 文件，需要先 backup + diff（risk_level=medium 操作）。
7. **P2：fcop init 还创建 `workspace/README.md`**。runtime 是否需要这个目录？P4 第 1 天验证。
8. **P3：terminal user 装 Python 3.10+ 是新前置条件**。CodeFlow v0.1 只要 Node 16+；v0.3+ 要 Node 16+ AND Python 3.10+ AND `pip install fcop==1.1.0`。`scripts/install.ps1` 需要相应更新（OPS 备注）。
9. **P3：pythonia v1.2.6 而非 v2.x**。我猜 v2.0.5 不存在踩坑。`package.json` 版本以 `npm view pythonia version` 实际为准。

## 七、P4 主 sprint 工期评估（DEV 视角）

| 阶段 | 工作 | 预估天数 |
|---|---|---:|
| Day 1 | 跑 `Project.init(workspace_dir="docs/agents")` 在仓库副本上，diff 与 v0.1 docs/agents/ 现状（识别字段错配）| 0.5 d |
| Day 2-3 | 引入 `pythonia` 到 `@codeflow/runtime` 主依赖；写 `FcopProjectClient` 适配层包 5 核心调用 + banner 检查 + PYTHON_BIN 校验 | 1.5 d |
| Day 4-5 | 替换 `TaskDispatcher.dispatchOne()` 内的手写 frontmatter → fcop `Project.write_task` | 1 d |
| Day 6-7 | 替换 `ReviewWriter.write()` → fcop `Project.write_review` | 1 d |
| Day 8 | 替换 `NeedsHumanGate` → fcop `Project.mark_human_approved` | 0.5 d |
| Day 9 | （可选）接入 fcop `event.schema` 让 ADMIN 手机端可订阅 fs-derived 事件 | 1 d |
| Day 10-11 | 全量回归 112 runtime 测试 + 重跑 v0.2.0-beta.3 smoke + 解决 surprise §五 全部问题 + 更新 install.ps1 | 1.5 d |
| Day 12 | 写 codeflow-runtime v0.3.0-alpha 发布说明 | 0.5 d |
| **合计** | | **~7-8 工作日**（含 0.5 d buffer，不含可选 Day 9）|

**与 PM TASK-005 §三给的 P4 4-5 d 偏紧的差距**：PM 给的预估假设替换 3 个 writer 等于 3 d；DEV 视角加 `FcopProjectClient` 适配层（1.5 d）+ install.ps1 / banner / PYTHON_BIN 检查（1 d）+ 全量回归（1.5 d）= 加 4 d，所以总 7-8 d。

PM 可决策：**是否接受 7-8 d**，或砍掉 Day 9 + 缩 Day 10-11 buffer 压到 6 d。

## 八、自决（同 DEV-001/010/012/013 §十一 风格）

| # | 决策 | 性质 | 说明 |
|---|---|---|---|
| 1 | spike 子项目用 `npm install` 而不是 PM 写的 `pnpm add` | 环境实情 | 系统无 pnpm，npm 完全等价。spike package.json 自给自足，不污染主 workspace。 |
| 2 | spike 用 OS temp 目录 + `mkdtempSync` 唯一名，不用 PM 给的 `D:/temp/codeflow-spike-project` | 工程稳健 | 避免与已有目录冲突；demo 退出自动 cleanup（用户磁盘不留垃圾）。PM TASK §六明示「DEV 风格自由」。 |
| 3 | 主交付 2 在 PM 5 调用基础上插入 `project.init()` 作为 (1.5) | API 实情 | 实际 fcop 必须先 init 才能 write_task；PM TASK §3.2 文案省略此步会跑不通。 |
| 4 | 主交付 3 写到 `docs/internal/p4-schema-mapping-v1.1.md`（PM TASK §3.3 指定路径）| 严格服从 | 不进 docs/agents/tasks/，技术调研笔记单独目录。 |
| 5 | 增加 `probe-surprises.ts` 跑 5 个独立探针（P1-P5）| 主动验证 | PM TASK §3.4 只列了 8 类 surprise 主题，DEV 主动跑实测代码给出**有 PASS/FAIL 数据**的答案，而不是只写文字推断。 |
| 6 | `packages/codeflow-runtime/tsconfig.json` 加 `"exclude": ["src/_spike/**/*"]` | 防止 spike 影响主代码 | 不然 `tsc --noEmit` 把 spike 的实验性 TS 编出来一堆松散 lint。runtime 112 测试不受影响（测试是 vitest 不走 tsc include）。**这是唯一改动 runtime 主代码树的文件**，且仅是 exclude 一个调研专用目录，不影响 prod build。 |
| 7 | 严格不向 fcop / pythonia 提 issue | 自约束 7 | surprise §五 列出的所有 pythonia README 暗示 / fcop API 文档不全，全部本机注释 + 本报告，**不外发到上游**。 |
| 8 | 严格不动主 `package.json` dependencies | PM TASK §3.5 明令 | `pythonia` 装在 `src/_spike/fcop-pythonia-spike/node_modules/`，不进 runtime 主依赖图。P4 主 sprint 启动时由 PM/DEV 决定升级路径。 |
| 9 | 严格不动 v0.2.0-beta.3 主代码 + runtime 112 测试不变 | PM TASK §3.5 明令 | 验证：tsc --noEmit 干净，`npm test` 仍 112/112 pass。 |

---

## 后置追加：仓库状态自检（本任务实际产出，不含其它会话遗留）

```
1 modified（唯一改动主代码树）:
  M  packages/codeflow-runtime/tsconfig.json   ← +1 行 "exclude": ["src/_spike/**/*"]

8 untracked（spike 隔离目录 — 不影响 prod build / runtime tests）:
  A  packages/codeflow-runtime/src/_spike/fcop-pythonia-spike/.gitignore
  A  packages/codeflow-runtime/src/_spike/fcop-pythonia-spike/README.md
  A  packages/codeflow-runtime/src/_spike/fcop-pythonia-spike/package.json
  A  packages/codeflow-runtime/src/_spike/fcop-pythonia-spike/tsconfig.json
  A  packages/codeflow-runtime/src/_spike/fcop-pythonia-spike/hello-fcop.ts         ← 主交付 1
  A  packages/codeflow-runtime/src/_spike/fcop-pythonia-spike/demo-fcop-api.ts      ← 主交付 2
  A  packages/codeflow-runtime/src/_spike/fcop-pythonia-spike/probe-surprises.ts    ← 主交付 4
  A  packages/codeflow-runtime/src/_spike/fcop-pythonia-spike/inspect-fcop-schemas.py ← 主交付 3 数据收集脚本

2 untracked（docs）:
  A  docs/internal/p4-schema-mapping-v1.1.md                  ← 主交付 3
  A  docs/agents/tasks/REPORT-20260511-005-DEV-to-PM.md       ← 本报告

总计：1 modified + 10 new = 11 项变更，0 secret detected (git diff 完整扫描)。

回归验证：
  npx tsc --noEmit (runtime) → clean
  npm test (runtime)        → 112/112 PASS（与 v0.2.0-beta.3 OPS-001 commit 后基线持平）
  spike node_modules/        → 已被 .gitignore 屏蔽，未进 untracked listing
```

### OPS 备注

**本任务 DEV 不需要 OPS commit**。PM TASK §六明示「与 OPS-003 (v0.2.0-beta.3 commit) 关系：完全独立」+「DEV 完工后 PM 立即评审 + 起草 TASK-006 (P4 主 sprint)，5/13 早上派给 DEV」。

PM 可决定：
- 让 OPS-004 commit + push spike 目录到 main（让 P4 主 sprint 有 baseline）
- 或者让 DEV 在 P4 主 sprint 时合并 spike → 主 runtime 时一并 commit

DEV 推荐**前者**（commit spike，让 reviewer / QA-015 等可以从 GitHub 看到 baseline 证据）。

---

DEV-001
2026-05-11 11:25 (UTC+8)
