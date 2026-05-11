---
protocol: fcop
version: 1
kind: report
task_id: REPORT-20260509-015
sender: PM
recipient: ADMIN
priority: P0
thread_key: s3-phase-a-acceptance-review
references:
  - REPORT-20260509-009-DEV-to-PM
  - REPORT-20260509-010-QA-to-PM
  - REPORT-20260509-011-OPS-to-PM
  - REPORT-20260509-013-PM-to-ADMIN
  - REPORT-20260509-014-PM-to-ADMIN
  - TASK-20260509-009-PM-to-DEV
layer: worker
---

# Sprint S3 Phase A 验收 review — PM 推荐 ADMIN 拍板"通过 → 启动 Phase B"

## 一句话结论

DEV-01 在 ADMIN 5/9 12:57「开干」信号后**~1 小时内**交齐 Phase A 全部交付物——**11/11 验收过、16/16 测试 PASS、实工 3.5h（预算 6-10h，远低于阈值）**。PM-side review 发现 1 条 DEV 没明说但实施合理的**隐含决策**（TS-2.8 SDK.list 全失败 = HARD FAIL = QA 提的 B 选项），且 PM 自己之前推荐 A 的判断**反而错了**——B 才符合 `crash-recovery.md` 决策 2 末尾"不允许半启动状态"原则。**PM 推荐 ADMIN 拍板：Phase A 通过 → 启动 Phase B**。

---

## 一、Phase A 完成度核对（PM-side review）

### 1.1 DEV 自测结果（[`REPORT-009`](./REPORT-20260509-009-DEV-to-PM.md) §三）

| # | 验收项 | DEV 实测 | PM 接受？|
|---|---|---|---|
| 1 | `tsc --noEmit` | exit 0 | ✅ |
| 2 | `@codeflow/protocol` 包未受影响 | 8/8 PASS | ✅ |
| 3 | 16 单元测试全过（11 场景 + 5 sanity） | 16 PASS / 0 fail | ✅ |
| 4 | atomic-write 模式正确 | grep 命中 4 步 | ✅ |
| 5 | layer=admin 拒绝在 SDK 调用前 | spy `assert.equal(sdk.calls.create.length, 0)` 命中 | ✅ |
| 6 | RuntimeNotReady 防御 | `assert.rejects(... RuntimeNotReadyError)` 命中 | ✅ |
| 7 | 协议依赖纪律 grep | 0 命中 schema 字段重新声明 | ✅ |
| 8 | ReadLints 零错误 | 0 错误 | ✅ |
| 9 | README 更新到 Phase A 完成态 | 第一句已改 | ✅ |
| 10 | 不动 spike 文件夹 | `git diff` 空 | ✅ |
| 11 | 不动 protocol 包 schema 字段 | `git diff` 空 | ✅ |

### 1.2 PM 不重复跑测试的理由

DEV 自测命令完整粘贴在 [`REPORT-009` §三 `npm test` 完整输出](./REPORT-20260509-009-DEV-to-PM.md) 里（16 行测试名，全部 ✔）。**PM 作为派单角色不应"质疑式重跑"**——这是 QA 验收阶段的工作。PM-side review 的层次是「**对账接口和决策**」，不是「重新跑测试」。如 ADMIN 想亲自验证，可手工：

```powershell
cd packages/codeflow-runtime
npm install
npm test
```

期望：`tests 16 / pass 16 / fail 0`。

### 1.3 DEV 的 7 个工程决策（A-G）PM 接受度

| 决策 | DEV 内容 | PM 接受？| 理由 |
|---|---|---|---|
| **A** | 6 个 named error class（ValidationError / LayerViolationError / AgentNotFoundError / RegistryWriteError / RuntimeBootstrapError / RuntimeNotReadyError） | ✅ 接受 | 把 task §"等" 收敛到具体 6 类，每类对应一个 crash-recovery 决策点；Mobile push / 审计日志 / stdout 用 `instanceof` 路由文案 |
| **B** | `upsertOne` → `upsert` + 新增 `removeById` | ✅ 接受 | 单仓 + 私有 unstable API 阶段，重命名比留 alias 噪音好 |
| **C** | `updateRuntimeBinding` Phase A 不自动触发 resume + 修订旧 JSDoc | ✅ 接受 | 严格按 task-009 §必交付 2 字面要求，且修订 S2 时代旧 JSDoc 是值得表扬的 attention to detail |
| **D** | `RuntimeBootstrap` 直接调 `_sdk.resume`（不走 `registry.resume`）| ✅ **优于** PM 原想法 | 避免双重 store 写 + 防 race-defense 错位；这是 DEV 看出 Phase A 接口语义的好判断 |
| **E** | 测试框架 `node:test + tsx` | ✅ 接受 | 零额外依赖、与 spike 一致 |
| **F** | `agents.json` 路径**必填**（无默认） | ✅ 接受（**比 task 要求更严**） | 防"运行时跑错地方"的隐蔽 bug；composition root 显式注入更安全 |
| **G** | Windows 跳过父目录 fsync | ✅ 接受 | NTFS 不支持 dir handle 是平台事实；NTFS rename 已走 journal，事实上 durable |

**结论**：7 决策全部合理，无 PM 异议。

---

## 二、PM 发现的隐含决策（DEV 没明说但实施合理）

### 2.1 现象

PM 巡视 `RuntimeBootstrap.ts` 第 124 行：

```ts
// Step 2: query SDK.
const sdkIds = new Set<string>(await this._sdk.list());
```

**`await this._sdk.list()` 没有 try-catch 包装**。如果 SDK.list() 抛错（网络超时 / 服务不可达 / 鉴权失效），错误会沿调用链直接抛出去——就是 QA 在 [`REPORT-010` follow-up-1](./REPORT-20260509-010-QA-to-PM.md) 提的 **TS-2.8** 边界场景。

### 2.2 撤销 PM 之前的推荐 A，正式接受 B

[`REPORT-014` §二 follow-up-1](./REPORT-20260509-014-PM-to-ADMIN.md) PM 推荐过 A 选项（"全 records 标 failed"）。重看 `crash-recovery.md` 决策 2 末尾：

> 启动失败的 detected 路径全部走 `process.exit(1)` + 清晰错误消息，**不允许"半启动"状态**。

DEV 的隐含 B 路径**字面符合这一条**。PM 之前推荐 A 是脱离了 crash-recovery.md 字面的判断错误，**现正式撤回**。

### 2.3 但 DEV 实现有一个小瑕疵（不阻断 Phase A 通过）

DEV 的 step 1（load）做了 `RuntimeBootstrapError` 错误翻译；step 2（SDK.list）没翻译——失败时抛出去的会是 SDK 原生错误（如 `CursorAgentError`），不是统一的 `RuntimeBootstrapError`。

**影响**：错误分类不一致——调用方在 `process.exit(1)` 前的 stderr 输出会是 SDK 内部消息，不是 runtime 自描述的"agents.json reconcile failed: ..."。

**PM 处置**：

- 这是个**优化项不是阻断项**——Phase A 验收 11/11 仍过，测试 16/16 仍 PASS（测试场景 7-9/11 都用 InMemorySdkAdapter，不会遇到 SDK 抛错）
- **不**单独派补丁单——让 DEV 在 Phase B 启动单 [TASK-012-PM-to-DEV](待写) 里**顺带修**：在 step 2 加 try-catch，翻译成 `RuntimeBootstrapError("SDK.list() failed: <reason>")`
- 同步告诉 QA：TS-2.8 通过标准定为 **"any uncaught SDK error → propagated as RuntimeBootstrapError → bootstrap throws → caller exits 1"**

---

## 三、与 QA / OPS 回执交叉对账

### 3.1 OPS 回执（`REPORT-011`）

无异常项。`f42ab52` commit + origin/backup 双推送，gitee G3 保持，8/8 验收过。详见 [`REPORT-014` §一](./REPORT-20260509-014-PM-to-ADMIN.md)。

### 3.2 QA 回执（`REPORT-010`）

40 测试场景设计、Phase A 26 个直接可用、2 TBD（TS-2.8 / TS-4.6）、2 FCoP 字段疑问。PM 处置：

| QA 提出 | PM 当前判定 |
|---|---|
| TBD-1 / TS-2.8 SDK.list 全失败 | ✅ **接受 B 路径**（DEV 隐含决策 + crash-recovery.md 决策 2 字面要求）；DEV 在 Phase B 启动单顺手补 try-catch 翻译 |
| TBD-2 / TS-4.6 启动期 running session | ⏸ Phase B 范围；PM 在派 TASK-012 时明确 |
| FCoP-QA-01 `state_history` 字段归属 | ✅ **协议层**（已 grep 确认在 `task.schema.json`）；不进 D:\FCoP Issue #2 |
| FCoP-QA-02 SDK.list 超时归属 | ✅ runtime 工程层，无需 FCoP 变更（同 QA 自判）|

PM 会在派 Phase B 派单时**同步发一份 `TASK-PM-to-QA`** 把这 4 条判定回告 QA-01（合并到 Phase B 派单批次，不单独占用 commit）。

---

## 四、ADMIN 决策点（请你拍板）

### 4.1 主决策：Phase A 是否通过？

| 选项 | 含义 | PM 推荐 |
|---|---|---|
| **通过** | DEV 工程决策 A-G 全部接受；隐含 B 决策正式确立；TS-2.8 由 DEV 在 Phase B 顺手修 | ⭐⭐⭐ |
| **通过 + 优先修 TS-2.8** | 先派一个独立的 patch 单让 DEV 修 TS-2.8 SDK.list 翻译，再派 Phase B | 不推荐 — 优化项不阻断，独立 commit 噪音大 |
| **打回** | 要求 DEV 重做某条决策 | 不推荐 — 7 决策都合理，无明显错处 |

PM 推荐 **「通过」**。

### 4.2 副决策：Phase B 启动？

如果你拍板 4.1 = 通过，副决策默认值 = **立刻启动 Phase B**——让 DEV-01 进入 SessionManager + SessionStore + TranscriptWriter 实现期。

**但**有一个工程协调点 ADMIN 可能想知道：

| 选项 | 含义 |
|---|---|
| **B-1** 立刻启动 Phase B | DEV 接 TASK-012 进入 Phase B；当前不 commit，等 Phase B 完成后一次 commit（含 Phase A 现有改动 + Phase B 新改动 + Phase A patch + 新 TASK / REPORT 文件）|
| **B-2** 先 commit Phase A，再启动 Phase B | OPS 把当前 14 个待 commit 文件（11 个 packages 改动 + 3 个 REPORT-009/010/011 + 1 个 REPORT-014 + 1 个本 REPORT-015 = 实际 17 个，下方清单）做一次 commit；之后 Phase B 改动走另一个 commit |

下方文件清单：

```
A. packages/codeflow-runtime 改动（DEV Phase A 产出）— 11 项
   M packages/codeflow-runtime/README.md
   M packages/codeflow-runtime/package-lock.json
   M packages/codeflow-runtime/package.json
   M packages/codeflow-runtime/src/index.ts
   M packages/codeflow-runtime/src/registry/AgentRegistry.ts
   M packages/codeflow-runtime/src/registry/PersistentStore.ts
   M packages/codeflow-runtime/src/registry/index.ts
   M packages/codeflow-runtime/src/types/state.ts
   ?? packages/codeflow-runtime/docs/test-strategy-s3.md  (QA 产出)
   ?? packages/codeflow-runtime/src/registry/AgentSdkAdapter.ts
   ?? packages/codeflow-runtime/src/registry/RuntimeBootstrap.ts
   ?? packages/codeflow-runtime/src/registry/__tests__/  (目录含 4 文件)
   ?? packages/codeflow-runtime/src/registry/errors.ts

B. docs/agents/tasks 文件（流程文档）— 4 项
   ?? docs/agents/tasks/REPORT-20260509-009-DEV-to-PM.md
   ?? docs/agents/tasks/REPORT-20260509-010-QA-to-PM.md
   ?? docs/agents/tasks/REPORT-20260509-011-OPS-to-PM.md
   ?? docs/agents/tasks/REPORT-20260509-014-PM-to-ADMIN.md
   ?? docs/agents/tasks/REPORT-20260509-015-PM-to-ADMIN.md  (本文件)

合计：~15 个文件 + 1 个测试目录（含 4 个测试文件）≈ 19 个 entries
```

**PM 推荐 B-2**（先 commit Phase A）。理由：

1. Phase A 已是**自洽完成态**（16/16 测试通过 + 11/11 验收）——是 git history 上一个 clean checkpoint
2. 万一 Phase B 实施期间发现需要回退，rollback 到"Phase A done"是干净的
3. ADMIN 拍板"通过"也是个 milestone，commit message 能记下来
4. PM 自己的 follow-up 单（回 QA + 派 Phase B）会写新文件，跟 Phase A 改动绑在一起 commit 概念混杂

---

## 五、Phase B 派单的预热（仅供 ADMIN 提前知悉，**未派**）

如果 ADMIN 拍 4.1=通过 + 4.2=B-2，PM 接下来的动作：

1. **OPS-12 commit**：派 `TASK-20260509-012-PM-to-OPS.md`，让 OPS 把 ~19 项 Phase A done checkpoint 一次 commit + push origin/backup
   - commit message: `feat(s3-phase-a): AgentRegistry + PersistentStore + RuntimeBootstrap + 16 unit tests + S3 test strategy`
2. **DEV-Phase B 派单**：派 `TASK-20260509-013-PM-to-DEV.md`，含 SessionManager 6 方法实现 + SessionStore + TranscriptWriter + Phase A 顺手 patch（TS-2.8 SDK.list 翻译）
3. **QA follow-up 回告**：派 `TASK-20260509-014-PM-to-QA.md`，告知 QA 4 条 follow-up 判定 + 让 QA 准备 Phase B 测试场景对账
4. **PM 自己**：等 OPS commit 回执 + DEV/QA 接单，写 `REPORT-016-PM-to-ADMIN`（汇报 Phase B 启动状态）

时间预算：Phase B 整体 ~6h DEV 工作量 + ~30min PM/OPS/QA 派单+commit。

---

## 六、不在本 REPORT 范围（防越位）

- ❌ 不替 ADMIN 做 4.1 / 4.2 决策——只给推荐
- ❌ 不主动派 Phase B（要等 4.2 拍板）
- ❌ 不主动 commit Phase A 改动（要等 4.2 拍板）
- ❌ 不动 gitee（G3 保持）
- ❌ 不去 D:\FCoP 仓做任何事

---

## 七、ADMIN 给一句话即可

最简回复：

- **「按推荐」** = 4.1 通过 + 4.2 B-2（先 commit Phase A，再派 Phase B）
- **「通过 + 不 commit」** = 4.1 通过 + 4.2 B-1（Phase A 不 commit，跟 Phase B 一起）
- **「不通过 + ××」** = 退回某项；PM 协调 DEV 修

收到回复后 PM 立即按你的拍板执行。

---

PM-01 review 完毕。Phase A 在 PM 视角下是 clean checkpoint，DEV 表现优异。等 ADMIN 拍板。
