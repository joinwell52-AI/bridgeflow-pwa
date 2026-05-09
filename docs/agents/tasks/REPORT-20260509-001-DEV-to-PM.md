---
protocol: fcop
version: 1
kind: report
task_id: REPORT-20260509-001
sender: DEV
recipient: PM
priority: P1
thread_key: codeflow-v2-runtime-protocol-design
references:
  - REPORT-20260425-001-FCoP-与-Bridgeflow-分仓-总结
  - TASK-20260425-001-ADMIN-to-PM
  - TASK-20260425-002-ADMIN-to-PM
layer: worker
---

# CodeFlow v2 设计文档 + Sprint S1 schema 包：身份反转 + 协议演进硬规则已锁死

## 一句话结论

CodeFlow v2 的「设计文档 + Sprint S1 协议骨架包 + 公私两份对外文档」三件套已经合上；ADMIN 在 5/8–5/9 给出的两条 identity-level 硬规则——**v2 是新身份不是 v1 升级** + **协议演进唯一合法仓库 = `D:\FCoP`**——已贯穿全文锁死，不再留口子。

---

## 一、本回合交付物清单（按依赖顺序）

### A. SDK 验证 spike（已完）

| 文件 | 作用 | 状态 |
|---|---|---|
| `_ignore/spike_sdk_doorbell/sender.ts` | `Agent.create()` 创建 + 流式输出全 8 类 SDK 事件 | ✅ 跑通 |
| `_ignore/spike_sdk_doorbell/ringer.ts` | `Agent.resume(agentId)` + `agent.send()` 持久上下文 | ✅ 跑通 |
| `_ignore/spike_sdk_doorbell/inspect.ts` | `Agent.list()` 列举团队 agent | ✅ 跑通 |
| `_ignore/spike_sdk_doorbell/list-models.ts` | 模型列表枚举 + headless 模型选择 | ✅ 跑通 |

**结论**：SDK 的 `create / resume / send / stream` 已经足以替换 v1 的 OCR/CDP "巡检引擎"。Cursor IDE UI 不再是必要依赖。详细 transcript 留在 `state/transcripts/`，作为 §0.7 身份反转的工程证据。

### B. CodeFlow v2 设计文档（设计权威，2221 行）

`docs/design/codeflow-v2-on-fcop-sdk.md`，13 个一级章节 + 完整附录：

| § | 标题 | 本回合关键产出 |
|---|---|---|
| §0.0 | Executive Summary | 1 屏 6 句话定调 + 6 个概念表 |
| §0.5 | AI OS 雏形：传统 OS → AI OS 概念映射 | Process=Task / Thread=Agent / IPC=FCoP / 权限=Review |
| §0.6 | 三层栈（Tool / Runtime / OS）+ 外部状态系统 + Runtime Engineering + AI OS 是下一代 ERP | §0.6.7 Agent Governability 护城河 + §0.6.8 Docker 类比 |
| §0.7 | 身份反转：从 Cursor 外挂到 Agent Runtime | **本回合加 §0.7.5 cross-link 块**（链到 §8 + §8.0 硬规则 #4） |
| §0.8 | First-phase scoping：开发型 AI Runtime + v0.1 最小闭环 PM→DEV→REVIEW→DONE | 6 条硬约束 + don't-do 清单 + Hello World 脚本 |
| §0.9 | Mobile-first Governance | 三层组织结构 + AI Team Console 4 屏 + HITL 触发条件 + 3 项未来治理能力 |
| §1.3 | 与 FCoP 协议的边界 | 加了「历史渊源」段，明确 codeflow-pwa 是 FCoP 的母体仓 |
| §2 | Runtime 子系统总览 + 角色注册表 | `roles.yaml` 加 `layer: worker / governance / admin` 字段 + 三类治理角色（PATROL/SECURITY/AUDIT） |
| §3 | **Runtime Protocol & Schemas（本回合最核心）** | 5 套 schema 全员到位：Agent / Task / Review / Session / Skill；Task 加 `risk_level`、Agent 加 `layer`、Review 加 `decision: needs_human` + `human_approval` 子结构、Skill 加 `tools[].risk_level / irreversible / cost_sensitive` |
| §3.3.1 | Task-as-folder 未来扩展 | **本回合重写 §3.3.1.b**：唯一合法升级路径 5 步流程图 + 3 条反面路径明确禁止 |
| §3.7 / §3.8 | Schema 演进策略 + v0.1 冻结策略 | **本回合加 ⚠️ 提醒块**：演进动作必须发生在 `D:\FCoP` |
| §8 | codeflow-pwa 仓库：v1 freeze + v2 新身份共生 | **本回合重写章首叙事 + §8.0 硬规则 #4 + §8.2 表头改"共生策略"** |
| §10 | 实施路线图 v0.1 → v1.0 | 含 Sprint S1（已完）/ S2（下一步）/ S3 / S4 / v0.2 Mobile Governance MVP / v0.3 AI Patrol / v0.5 Review Board / v1.0 Schema Freeze |
| §11 | 附录：参考 + Essay 索引 + 9 项术语表 + 草稿历史 | — |

### C. Sprint S1 协议骨架包（`packages/codeflow-protocol/`）

§3 的 reference implementation，已可执行：

```
packages/codeflow-protocol/
├── package.json              (deps: ajv / gray-matter / tsx / typescript)
├── tsconfig.json
├── README.md
├── schemas/                  (5 套 JSON Schema：§3.2-§3.6 全员)
│   ├── agent.schema.json
│   ├── task.schema.json
│   ├── review.schema.json
│   ├── session.schema.json
│   └── skill.schema.json
├── src/
│   ├── validator.ts          (AJV 包装：load / validate / 友好错误)
│   ├── index.ts              (公开 API)
│   └── cli.ts                (`codeflow-validate <file>` 工具)
└── fixtures/
    ├── agent/   valid-dev01.json + invalid-missing-layer.json
    ├── task/    valid-task001.md + invalid-bad-status.md
    ├── review/  valid-review001.md
    ├── session/ valid-session001.json
    └── skill/   valid-git.json + invalid-no-fcop-kernel.json
```

**已通过的验收**：
- `npm install` ✅
- `npm run validate:fixtures` ✅（valid 全过 / invalid 全部如预期失败 + 给出可读错误）
- `tsc --noEmit` ✅

### D. 公私两份对外文档（与设计文档对账）

| 文件 | 受众 | 长度 |
|---|---|---|
| `docs/codeflow-overview.md` | 公开（中文 5 分钟阅读） | 已发 v0.1 草稿 |
| `docs/codeflow-overview.en.md` | 公开（英文同上） | 已发 v0.1 草稿 |
| `README.md` / `README.en.md` / `README.zh.md` | 三份主 README 加 v2 入口块 | 同步 |

**对账规则**：overview 的"v0.1 单文件 + v0.x+ Task-as-folder"两段叙事 = 设计文档 §3.3.1 工程兑现；overview 任何 schema 字段描述 = 设计文档 §3 单一事实源。两边不一致 = 改设计文档为准。

---

## 二、ADMIN 5/8–5/9 两条硬规则的落地证据

### 硬规则 1：v2 不是 v1 的"下一个版本"，是彻底换了身份的产品形态

ADMIN 原话（5/9 1:28）：
> "新的码流，已经完全不是开始的外挂了，而是彻底改了身份了"

落地编辑：

| 位置 | 改动 | 验证锚点 |
|---|---|---|
| §8 章首 | 旧措辞「v2 是母体仓的下一个版本」 → 新叙事「v2 是 *彻底换了身份的产品形态*；v1 / v2 共享同一仓库但作为 *不同身份的产品* 共生（v1 freeze + v2 新身份）」 | `docs/design/codeflow-v2-on-fcop-sdk.md` §8 头部 |
| §8.2 表头 | 旧表头「演进策略」 → 新表头「共生策略」+ 表内 `codeflow-desktop/` 行明确标记「❌ 不在 v2 主线 —— v2 完全不依赖它」 | 同上 §8.2 |
| §0.7.5 | 加 🔁 cross-link 块：身份反转的工程后果 → 链到 §8 + §8.0 硬规则 #4 | 同上 §0.7.5 末尾 |

### 硬规则 2：协议演进唯一合法仓库 = `D:\FCoP`

ADMIN 原话（5/9 1:28）：
> "如果fcop协议需要升级，那也要通过fcop的单独的目录和仓库去更新！"

落地编辑：

| 位置 | 改动 | 验证锚点 |
|---|---|---|
| §8.0 硬规则 | 从 3 条扩成 4 条；硬规则 #4 直接锁死「协议演进唯一合法仓库 = D:\FCoP」+ 4 条具体禁令 | `docs/design/codeflow-v2-on-fcop-sdk.md` §8.0 |
| §3.3.1.b | **整章重写**：砍掉旧路径 A（v2 单边 fork schema），只剩唯一合法升级路径 5 步流程图 + 3 条反面路径明确禁止 + 2 个对比例子（Task-as-folder 正例 / `layer` `risk_level` 当前是「待提案 D:\FCoP review」反例） | 同上 §3.3.1.b |
| §3.7 末尾 | 加 ⚠️ 提醒块：5 个 schema 任何演进动作必须发生在 `D:\FCoP` | 同上 §3.7 |
| §3.8 末尾 | 加 ⚠️ 提醒块：v0.1→v1.0 冻结/升级动作发生在 `D:\FCoP` 仓 | 同上 §3.8 |
| §5 占位行 | 旧措辞「路径 A/B/C」 → 「接入方式 A/B/C」+ 注「这是 *消费协议* 的 3 种方式，不是 *演进协议* 的路径」，避免与已砍掉的概念碰撞 | 同上 §4-7,9 占位表 |
| §8.2 / §8.3 | 旧措辞「路径 B 逆向贡献」 → 「按 §8.0 硬规则 #4 + §3.3.1.b 唯一合法升级路径」 | 同上 §8.2 `(extern) D:\FCoP/` 行；§8.3 触发条件表 |

### 硬规则 2 暴露的工程现状（PM 须知）

设计文档 §3 已经把 `layer` / `risk_level` / `needs_human` / `human_approval` / Task-as-folder 这 5 个字段写进 schema，但**这些字段当前都还没在 `D:\FCoP` 仓里 review 通过**——按 §8.0 硬规则 #4，它们处于「v0.1-alpha-pending-fcop-review」状态。

- **后果**：本仓 `packages/codeflow-protocol/` 的 schema 文件不能立刻打 v0.1 stable tag；需要先把这 5 个字段统一打包提案到 `D:\FCoP` 仓，等 spec 评审通过 + Python 双包发版后，本仓再镜像。
- **缓解**：DEV-01 已经在 `_ignore/fcop-publish-proposal.md` 里准备了一份逆向贡献提案草稿（含 PR 文案 + 5 字段批量提案），随时可以由 PM 决定推送时机。
- **风险**：如果 D:\FCoP 维护者拒绝某些字段，本仓 schema 必须撤回——这就是 §8.0 硬规则 #4 留下的"代价"。但 ADMIN 这条规则就是要避免"v2 在 TS 这边永久 fork"的更大风险，代价合理。

---

## 三、与之前承诺的对账（5/8 当晚的执行顺序）

ADMIN 当时给的执行顺序：「3-1-2」+ 后续追加「fcop 是单独抽离出去的」+ 「彻底改了身份」+ 「协议升级走 fcop 单独仓」。

| # | 承诺项 | 状态 |
|---|---|---|
| 3 | 写 REPORT-20260509-001-DEV-to-PM.md | ✅ **本文件** |
| 1 | 写 Sprint S2 的 PM-to-DEV 任务文件（Agent Registry + Session Manager 设计骨架） | 待 PM 拍板派单（草稿已就位） |
| 2 | 准备 D:\FCoP 逆向贡献提案 `_ignore/fcop-publish-proposal.md`（含 PR 文案 + 预处理清单） | 待 PM 拍板范围（草稿已就位）；范围按硬规则 #2 暴露的工程现状自然扩成 5 字段批量提案 |

---

## 四、影响范围 & 自测结果（按 DEV-01 规则）

### 修改的文件

| 区域 | 改动 |
|---|---|
| `docs/design/codeflow-v2-on-fcop-sdk.md` | 全章累计加到 2221 行；本回合两刀（5/8 历史溯源刀 + 5/9 身份反转刀）共编辑 ~12 处 |
| `docs/codeflow-overview.md` / `.en.md` | 新增 |
| `README.md` / `README.en.md` / `README.zh.md` | 各加 v2 入口块 |
| `packages/codeflow-protocol/` | 新增整个 reference implementation 包（5 schema + validator + CLI + 9 fixtures） |
| `_ignore/spike_sdk_doorbell/` | 新增 SDK 验证 spike（4 个 .ts 入口 + tsconfig + README） |

### 是否影响已有功能

- **无影响**——所有改动都是 *新增* 或 *文档重写*，没有动 v1 的 `codeflow-desktop/` / `web/pwa/` / `server/relay/` 任何代码。
- §8.2 把 `codeflow-desktop/` 标记为「不在 v2 主线」是 *身份层声明*，不是 *删代码*；v1 维护期照常。

### 是否需要重启服务

**不需要**——本回合纯文档 + 新增子包，无服务变更。

### 自测结果

| 检查 | 结果 |
|---|---|
| `ReadLints docs/design/codeflow-v2-on-fcop-sdk.md` | ✅ No linter errors |
| `ReadLints docs/codeflow-overview.md` | ✅ No linter errors |
| `ReadLints docs/codeflow-overview.en.md` | ✅ No linter errors |
| `ReadLints packages/codeflow-protocol/` | ✅ No linter errors |
| `npm run validate:fixtures`（packages/codeflow-protocol/） | ✅ valid 全过 / invalid 全失败（含可读错误） |
| `tsc --noEmit`（packages/codeflow-protocol/） | ✅ 通过 |
| 设计文档内部锚点检查（`#3.3.1.b` / `#8.0` / `#8.2` / `#0.7.5`） | ✅ 5 处 cross-link 全部对齐 |
| 设计文档术语一致性检查（"路径 A/B" 是否还指 *协议演进*） | ✅ 已统一：协议演进唯一合法路径 = §8.0 硬规则 #4；§5 的 A/B/C 显式改名为"接入方式" |

---

## 五、给 PM 的下一步建议

按 §10 路线图，**Sprint S2 = Agent Registry + Session Manager 设计骨架**。建议 PM 立刻派单，因为：

1. S1 schema 包是 *协议骨架*，但还没有 *运行时* 把 schema 跑起来
2. S2 是从「能验证文件」到「能管理 agent 实例」的最小跃迁，不依赖 D:\FCoP 上游评审节奏（即使 5 字段提案被 D:\FCoP 反复 review，S2 的 Registry / Session Manager 接口设计也可以并行做）
3. ADMIN 在 §0.8 的"v0.1 最小闭环"明确了 PM→DEV→REVIEW→DONE 必须能跑起来——S2 是这条闭环的执行引擎雏形

**配套：D:\FCoP 逆向贡献提案** —— 建议 PM 决定是先拉一个 OPS 单（在 D:\FCoP 工作树开 PR）还是 PM 自己先在 GitHub 开 Issue 探口风。两条路径成本不同，请 ADMIN 拍板。

---

## 六、风险与未决项

| 项 | 状态 | 责任方 |
|---|---|---|
| §3 schema 5 字段未在 D:\FCoP review 通过 | pending | PM 决定是否立刻发逆向贡献提案 |
| `fcop-mcp/` 子目录在本仓的 LEGACY 副本下线时机 | pending | §8.2 已写明 v0.3 评估彻底删除 |
| `codeflow-desktop/` 归档到 `legacy/` 的时机 | pending | §8.2 已写明 v0.3 后评估 |
| Mobile Governance MVP 的工程拆解（§0.9 → 实际 sprint） | 已在 §10 v0.2 列出 7 个 sprint（S5–S11），尚未派单 | PM |

---

DEV-01 待命。本回合所有文件都可以直接 `git diff` 预览，确认无误后再决定下一步。
