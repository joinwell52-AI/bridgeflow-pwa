# `@codeflow/protocol` — CodeFlow AI Runtime Protocol (v0.1-alpha)

> **Sprint S1 deliverable** of [设计文档 §10.2](../../docs/design/codeflow-v2-on-fcop-sdk.md).
>
> 5 类 Runtime Schemas（Agent / Task / Review / Session / Skill）的 JSON Schema 文件 + ajv-based validator。
>
> 这是 **CodeFlow v2 真正的核心交付物**——见 [设计文档 §3](../../docs/design/codeflow-v2-on-fcop-sdk.md) 和 [overview §六](../../docs/codeflow-overview.md)。

## 安装

```bash
cd packages/codeflow-protocol
npm install
```

## 验收（Sprint S1 acceptance）

```bash
# 1. typecheck 必须过
npm run typecheck

# 2. 5 个 valid fixture 必须全部通过
npm run validate:all

# 3. 3 个 invalid 负例必须全部被拒绝（`--expect-fail` 反转退出码）
npm run test:invalid

# 4. 一键全跑
npm test
```

期望：所有命令 exit code = 0。

## 单文件验证

```bash
npx tsx src/cli.ts <type> <path>
# 例：
npx tsx src/cli.ts agent path/to/some-agent.json
npx tsx src/cli.ts task  path/to/TASK-20260601-001-PM-to-DEV.md
```

`<type>` 必须是 `agent | task | review | session | skill` 之一。
- `agent` / `session` / `skill`：直接读 JSON 文件
- `task` / `review`：读 Markdown 文件的 YAML front-matter

## 文件结构

```
packages/codeflow-protocol/
├── package.json
├── tsconfig.json
├── README.md                          ← 本文件
├── schemas/                           ← 5 类 JSON Schema（draft-07）
│   ├── agent.schema.json              ← §3.2
│   ├── task.schema.json               ← §3.3
│   ├── review.schema.json             ← §3.4
│   ├── session.schema.json            ← §3.5
│   └── skill.schema.json              ← §3.6
├── src/
│   ├── index.ts                       ← 程序化 API（loadSchema / validate）
│   ├── validator.ts                   ← ajv 包装
│   └── cli.ts                         ← codeflow-validate CLI
└── fixtures/                          ← Valid + invalid 示例
    ├── agent/
    │   ├── valid-dev01.json
    │   └── invalid-missing-layer.json
    ├── task/
    │   ├── valid-task001.md
    │   └── invalid-bad-status.md
    ├── review/
    │   └── valid-review001.md
    ├── session/
    │   └── valid-session001.json
    └── skill/
        ├── valid-git.json
        └── invalid-no-fcop-kernel.json
```

## 与 §3 schema 章节的对应关系

| 文件 | 设计文档章节 | 关键字段 |
|---|---|---|
| `schemas/agent.schema.json` | §3.2 | `agent_id` / `layer` / `runtime` / `skills` / `status` |
| `schemas/task.schema.json` | §3.3 | `task_id` / `status` / `state_history` / `risk_level` |
| `schemas/review.schema.json` | §3.4 | `decision` (含 `needs_human`) / `human_approval` |
| `schemas/session.schema.json` | §3.5 | `session_id` / `runs` / `total_cost_usd` |
| `schemas/skill.schema.json` | §3.6 | `tools[].risk_level` / `irreversible` / `cost_sensitive` |

## v0.1 schema 冻结策略

详见 [设计文档 §3.8](../../docs/design/codeflow-v2-on-fcop-sdk.md)。

简言之：
- v0.1 起：**必填字段** 冻结，不允许重命名/删除/改语义
- 可选字段在 v1.0 之前可调整
- v1.0 判定 = 4 选 3（≥3 第三方实现 / 90 天无 breaking / ≥1 篇 essay / 通过 fuzz）

## 第三方接入示例

```ts
import { loadSchema, validate } from "@codeflow/protocol";

const schema = await loadSchema("agent");
const result = validate(schema, { agent_id: "DEV-01", /* ... */ });

if (!result.valid) {
  console.error(result.errors);
}
```

## 相关链接

- [`docs/codeflow-overview.md`](../../docs/codeflow-overview.md) — 5 分钟对外速读
- [`docs/design/codeflow-v2-on-fcop-sdk.md`](../../docs/design/codeflow-v2-on-fcop-sdk.md) — 完整设计文档
- [`docs/design/codeflow-v2-on-fcop-sdk.md#3-runtime-protocol--schemasv2-的核心交付物`](../../docs/design/codeflow-v2-on-fcop-sdk.md) — §3 协议章节
