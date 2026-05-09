---
protocol: fcop
version: 1
kind: report
task_id: REPORT-20260509-003
sender: PM
recipient: ADMIN
priority: P1
thread_key: codeflow-v2-runtime-protocol-design
references:
  - REPORT-20260509-001-DEV-to-PM
  - REPORT-20260509-002-DEV-to-PM
  - TASK-20260509-002-PM-to-DEV
  - TASK-20260509-003-ADMIN-to-PM
  - TASK-20260509-004-PM-to-ADMIN
  - _ignore/fcop-publish-proposal.md
  - _ignore/fcop-issue-draft.md
---

# 5/8 晚 → 5/9 凌晨阶段性总结：身份反转 + S1/S2 落地 + D:\FCoP 提案就位

## 一句话结论

今晚这一刀把 **CodeFlow v2 从「设计哲学」推到「可执行内核骨架」**——5/8 凌晨开始的「身份反转」哲学讨论，在 5/9 凌晨之前已经完成了 *设计文档锁死 + Sprint S1 协议骨架交付 + Sprint S2 运行时接口骨架交付 + D:\FCoP 跨仓提案就绪* 的完整闭环。三件事的纪律都按 §8.0 硬规则 #4 严守：本仓没有任何单边创造的 schema 字段。

## 一、时间线（按 ADMIN 指令时间顺序）

| 时间 | ADMIN 指令性质 | DEV/PM 落地 |
|---|---|---|
| 5/8 凌晨 | identity-level：「彻底改了身份」+「协议升级走 fcop 单独仓」 | DEV 完成设计文档 §3.3.1.b 重写 + §8.0 硬规则 #4 + §8 章首叙事 + §3.7/§3.8 提醒块 + §0.7.5 cross-link（共 5 处编辑 + 3 处对账） |
| 5/8 凌晨 | 「先做 3-1-2」执行顺序 | DEV 写 REPORT-001（汇报当晚的所有编辑+S1）；PM 派 TASK-002（S2 设计骨架）；PM 准备 _ignore/fcop-publish-proposal.md（提案预备稿） |
| 5/9 01:58 | 拍板 D:\FCoP 提案 3 项决策（Option A + PM 直接提 + 5 ADR 全推） | PM 落 TASK-003（ADMIN 拍板）+ TASK-004（PM 接单回执）+ _ignore/fcop-issue-draft.md（Issue 推送内容草稿） |
| 5/9 09:14 | 「开工」信号 | DEV 完成 Sprint S2 全部 5 项必交付（@codeflow/runtime 包 + types.ts 镜像 + crash-recovery.md 4 决策）+ 写 REPORT-002 |

## 二、ADMIN 两条 identity-level 硬规则的 *最终落地证据矩阵*

### 硬规则 1：v2 = 彻底换了身份的产品形态（不是 v1 的下一个版本）

| 落地位置 | 验证 |
|---|---|
| 设计文档 §8 章首改写 | "v1 / v2 共享同一仓库但作为 *不同身份的产品* 共生" |
| 设计文档 §0.7.5 加 🔁 cross-link 块 | 把"身份反转"哲学链到 §8 + §8.0 |
| 设计文档 §8.2 表头改"共生策略" | `codeflow-desktop/` 行明确标记「❌ 不在 v2 主线」 |
| `packages/codeflow-runtime/` 包结构 | 与 v1 `codeflow-desktop/` *完全独立*，0 代码依赖 |

### 硬规则 2：协议演进唯一合法仓库 = `D:\FCoP`

| 落地位置 | 验证 |
|---|---|
| 设计文档 §8.0 加硬规则 #4（4 条具体禁令） | 含「本仓单边创造 schema 字段不允许」 |
| 设计文档 §3.3.1.b 整章重写 | 砍掉路径 A，唯一合法路径 5 步流程图 + 3 反面路径明确禁止 |
| 设计文档 §3.7 / §3.8 末尾 ⚠️ 提醒块 | schema 演进 / v0.1→v1.0 冻结决定都在 D:\FCoP |
| `packages/codeflow-protocol/src/types.ts` 文件头部 | 写明「DO NOT add fields here that do not exist in the corresponding schema」 |
| `packages/codeflow-runtime/src/types/state.ts` 文件头部 | 写明「Schema gaps go to the report, NOT to this file」 |
| Sprint S2 实测：0 schema 缺口、0 fork、0 D:\FCoP 提案追加 | DEV 在 REPORT-002 §四验证 |

**结论：硬规则 1+2 已经从「设计文档里的话」转化成「代码层的物理约束」**——后续 DEV 即使想偷偷加 schema 字段，也得先穿过 `types.ts` / `state.ts` 文件头部的 governance rules block，违规可被 PR review 一眼揪出。

## 三、文件总账（一张表看完今晚的所有产出）

### 设计文档区
| 文件 | 动作 | 备注 |
|---|---|---|
| `docs/design/codeflow-v2-on-fcop-sdk.md` | **改** | 编辑 5 处（§3.3.1.b / §8.0 / §8 章首 / §3.7+§3.8 / §0.7.5）+ 3 处对账（§5/§8.2/§8.3 措辞统一）；2221 行；lint 零错误 |

### Sprint S1 协议骨架（@codeflow/protocol）
| 文件 | 动作 | 备注 |
|---|---|---|
| `packages/codeflow-protocol/src/types.ts` | **新** | 5 schema 的 1:1 TS 类型镜像（手写，~280 行）；含 governance rules block |
| `packages/codeflow-protocol/src/index.ts` | 改 | 新增 25 个 schema 类型导出 |

### Sprint S2 运行时骨架（@codeflow/runtime —— 全新包）
| 文件 | 动作 | 备注 |
|---|---|---|
| `packages/codeflow-runtime/package.json` | **新** | name: @codeflow/runtime, deps: @codeflow/protocol |
| `packages/codeflow-runtime/tsconfig.json` | **新** | strict + noUncheckedIndexedAccess + paths 别名 |
| `packages/codeflow-runtime/.gitignore` | **新** | — |
| `packages/codeflow-runtime/README.md` | **新** | 第一句即明示 "S2 设计骨架，方法体未实现" |
| `packages/codeflow-runtime/src/index.ts` | **新** | 公开 API barrel（12 个导出） |
| `packages/codeflow-runtime/src/types/state.ts` | **新** | runtime 私有类型（runtime_ 前缀严守边界） |
| `packages/codeflow-runtime/src/registry/AgentRegistry.ts` | **新** | 6 方法接口骨架 + JSDoc + throw not-implemented |
| `packages/codeflow-runtime/src/registry/PersistentStore.ts` | **新** | 存储契约 interface + factory marker |
| `packages/codeflow-runtime/src/registry/index.ts` | **新** | 子模块 barrel |
| `packages/codeflow-runtime/src/session/SessionManager.ts` | **新** | 6 方法接口骨架（含 Emergency Stop ⛔）|
| `packages/codeflow-runtime/src/session/RunHandle.ts` | **新** | 句柄抽象（re-export from state.ts） |
| `packages/codeflow-runtime/src/session/index.ts` | **新** | 子模块 barrel |
| `packages/codeflow-runtime/fixtures/agents.json` | **新** | 3 agent 样例（PM/DEV worker + QA governance） |
| `packages/codeflow-runtime/fixtures/sessions/valid-runtime-session-001.json` | **新** | 1 session 样例 |
| `packages/codeflow-runtime/docs/crash-recovery.md` | **新** | 4 决策完整论证（~230 行） |

### 任务/回执文件区
| 文件 | 动作 | 备注 |
|---|---|---|
| `docs/agents/tasks/REPORT-20260509-001-DEV-to-PM.md` | **新** | 5/8 晚 + 设计文档 + S1 总回执 |
| `docs/agents/tasks/TASK-20260509-002-PM-to-DEV.md` | **新** | S2 派单（含 5 项必交付 + 8 条不做） |
| `docs/agents/tasks/TASK-20260509-003-ADMIN-to-PM.md` | **新** | ADMIN 3 项拍板落档 |
| `docs/agents/tasks/TASK-20260509-004-PM-to-ADMIN.md` | **新** | PM 接单 + 4 动作执行计划 |
| `docs/agents/tasks/REPORT-20260509-002-DEV-to-PM.md` | **新** | S2 完成回执（含 0 schema 缺口验证） |
| `docs/agents/tasks/REPORT-20260509-003-PM-to-ADMIN.md` | **新** | **本文件** |

### 工程预备稿（_ignore/，不进 git）
| 文件 | 动作 | 备注 |
|---|---|---|
| `_ignore/fcop-publish-proposal.md` | **新** | 5+1 字段提案 + 推送时机 3 选项 + 决策清单 |
| `_ignore/fcop-issue-draft.md` | **新** | D:\FCoP Issue 完整 markdown payload + 8 项发布前自检 |

**今晚累计：18 个新文件 + 2 个修改文件，5 处设计文档主修订 + 3 处对账修订**。

## 四、所有自检通过

| 检查 | 范围 | 结果 |
|---|---|---|
| `tsc --noEmit` | @codeflow/protocol | ✅ 0 报错 |
| `tsc --noEmit` | @codeflow/runtime（strict + noUncheckedIndexedAccess） | ✅ 0 报错 |
| `npm test` | @codeflow/protocol（5 valid + 3 invalid fixtures） | ✅ 全部如预期 |
| `npm install` | @codeflow/runtime（首次安装 file: 依赖） | ✅ 4.2s，0 报错 |
| `ReadLints` | 设计文档 + 所有任务/回执文件 + 两个包 | ✅ 0 错误 |
| 设计文档锚点检查（5 处 cross-link 对齐） | §3.3.1.b / §8.0 / §8.2 / §0.7.5 / §3.7 / §3.8 | ✅ 全部对齐 |
| 协议依赖纪律 grep | runtime 包不含 schema 字段名重新声明 | ✅ 通过 |

## 五、当前等 ADMIN 拍板的悬挂事项（共 3 件）

按优先级排序：

### 第 1 件（堵塞 S3 启动）：S2 review + S3 「开工」信号

- **看什么**：[REPORT-20260509-002-DEV-to-PM.md](REPORT-20260509-002-DEV-to-PM.md) §五（crash-recovery 4 决策）+ [crash-recovery.md](../../packages/codeflow-runtime/docs/crash-recovery.md)
- **拍什么**：4 个工程层决策（写入时机 / resume 流程 / SDK 不一致 / Session 持久化）是否方向正确；要不要修订
- **再然后**：「S3 开工」信号 → DEV 按 crash-recovery.md 每个决策末尾的"S3 关键交付"清单落地真实逻辑
- **预算**：S3 一刀约 1-2 天（4 个决策的实现各约 4-8 小时）

### 第 2 件（堵塞跨仓 PR）：D:\FCoP Issue 推送

- **看什么**：[_ignore/fcop-issue-draft.md](../../_ignore/fcop-issue-draft.md)（~280 行 GitHub Issue body）
- **拍什么**：标题用短版还是长版 / body 是否需要修订 / 是否同意 PM 立刻 `gh issue create`
- **进展**：S2 完成后已确认 0 字段追加，提案范围保持不变（仍是 5 字段：layer / risk_level / needs_human / human_approval / Skill risk meta）
- **预算**：推送本身 ≤ 5 分钟；D:\FCoP 维护者 review 周期不在我们手里

### 第 3 件（不堵塞、可后置）：v0.2 Mobile Governance MVP sprint 拆解

- **看什么**：设计文档 §10.3（v0.2 列了 S7-S10 4 个 sprint，但具体派单还没做）
- **拍什么**：v0.1 完结再启动，还是 v0.1 / v0.2 部分并行
- **当前状态**：等 v0.1 S3-S6 走完再决定即可；现在不动

## 六、下一刀的 3 个候选路径（PM 推荐）

| 路径 | 触发条件 | 推荐度 |
|---|---|---|
| **A. 推 D:\FCoP Issue（一刀，5 分钟）** | ADMIN 在 _ignore/fcop-issue-draft.md 上选短/长标题 | ⭐⭐⭐ 立刻可做、零风险、并行价值高（D:\FCoP review 周期长，越早开始越好） |
| **B. 启动 S3（一刀 1-2 天）** | ADMIN 在 crash-recovery.md 上拍 4 决策方向 | ⭐⭐⭐ 是 v0.1 主路径；S3 不依赖路径 A |
| **C. A + B 同时启动** | 上述两条都拍 | ⭐⭐⭐⭐ 最优——零冲突、零依赖、各自跑各自的 |

PM 自己的偏好是 **路径 C**：D:\FCoP Issue 推一推（PM 自己 5 分钟可完成，不占 DEV 时间）+ DEV 同时启动 S3 实施。但具体怎么走由 ADMIN 拍板。

## 七、风险与未决项

| 项 | 状态 | 缓解 |
|---|---|---|
| `@codeflow/protocol` 5 字段处于「pending fcop review」状态 | active | 路径 A 推 Issue 后转入 active review |
| crash-recovery.md 4 决策可能被 ADMIN 反转 | possible | DEV 按 ADMIN 反馈在 S3 启动前修订；不构成代码层风险 |
| `codeflow-desktop/` 与 v2 的最终归属时机 | future | §8.2 已规划 v0.3 后评估归档 `legacy/`，本阶段不动 |
| 整个早晨 DEV/PM 双重身份运作，没有真人 PM/QA 互检 | recurring | 所有产出都强 lint + 强协议依赖纪律 + 完整自检；缺人肉 review 是 ADMIN 拍板时一并补上 |

---

PM-01 待命。今晚的总账已落齐，等 ADMIN 在 *3 件悬挂事项* 上指方向。
