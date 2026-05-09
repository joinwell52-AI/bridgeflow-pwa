---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-008
sender: PM
recipient: ADMIN
priority: P0
thread_key: codeflow-pwa-rule5-purge-fcop-definitions
references:
  - REPORT-20260509-007-PM-to-ADMIN
  - TASK-20260509-006-PM-to-DEV
  - REPORT-20260509-006-DEV-to-PM
---

# 两条 ADMIN 总纲句已锁进设计文档「宪法块」+ §8.6 退役账本已建

## ADMIN 5/9 双总纲句（原话锁定）

| 时刻 | 原话 | 锁定的含义 |
|---|---|---|
| 10:48 | 「这个项目文件就是码流的，目前项目是用 cursor 的 sdk，应用 fcop-mcp。」 | **身份 + 技术栈** |
| 10:51 | 「码流是做成一个 CodeFlow 的真正定位：一个面向多 Agent 协作开发的轻量级 AI Runtime / AI OS。」 | **真正定位** |

PM 把这两句作为 v2 项目的"宪法级引用句"——任何后续修改如果与之矛盾，必须先经 ADMIN 显式授权改动 §0.0。

## 本轮做了什么（7 处文档改动 + 1 处账本新增）

| # | 位置 | 改动 | 结果 |
|---|---|---|---|
| 1 | `docs/design/codeflow-v2-on-fcop-sdk.md` §0.0 顶部 | 新增「📜 项目宪法」块，嵌两条原话 + 6 行解读表 + 与英文 tagline 的对应关系 | ✅ |
| 2 | 同文档 §8.0 硬规则 #2 | 措辞从"规划下线"改为"已物理删除（5/9）" | ✅ |
| 3 | 同文档 §8.0 5.b 表 | 增加"状态"列，9 项标 ⛔ → 已删，并新增 2 项历史遗漏（requirements.txt + README.md） | ✅ |
| 4 | 同文档 §8.2 节首 | 引用从「§8.0（4 条硬规则）」改为「§8.0（5 条硬规则）」+ 嵌入 ADMIN 5/9 10:48 总纲句作为本节"宪法级引用句" | ✅ |
| 5 | 同文档 §8.2 表 `codeflow-plugin/` 行 | "保留并扩展" → "已瘦身（5/9）"，列出删除/保留清单 | ✅ |
| 6 | 同文档 §8.2 表 `fcop-mcp/` 行 | "规划下线" → "⛔ 已删除（5/9）" | ✅ |
| 7 | 同文档 §8.1 ASCII 图 | `fcop-mcp/` 标注"已删除（5/9）"；`codeflow-plugin/` 标注"已瘦身" | ✅ |
| 8 | 同文档 §8.5 时间表 | 把 5/9 退役从 2027-Q1 提前到 2026-Q2 当前格；后续节点同步重新排 | ✅ |
| 9 | 同文档 §8 末尾新增 §8.6 | LEGACY 退役账本（8.6.1 触发 + 8.6.2 已退役 9 项 + 8.6.3 剩余 10 项 backlog + 8.6.4 未来流程 4 步） | ✅ |

## 自检

| 项 | 命令/方式 | 结果 |
|---|---|---|
| 设计文档 lint | `ReadLints` on `docs/design/codeflow-v2-on-fcop-sdk.md` | ✅ 0 错误 |
| 文档全体 §8.6 引用一致性 | grep `§8.6` → 现在 §8.0 5.e + §8.5 时间表 + §8.6 自身均存在且配对 | ✅ |
| `@codeflow/protocol` 测试 | 5/9 早些时候已跑过 8/8 PASS（删除动作之后） | ✅ 仍有效 |
| 全程未触碰 `D:\FCoP` 上游仓 | — | ✅ |
| 全程未触碰生产服务 | — | ✅（无 OPS-01 介入） |

## §8.6 backlog 中下次要做的（PM 自排，**不再问 ADMIN**）

| # | 项 | 优先级 | 触发节点 |
|---|---|---|---|
| 4 | `docs/integrations/fcop-standalone-zh.md` 按 v2 身份重写 | P1 | v0.2 sprint |
| 5 | `codeflow-plugin/` 剩余资产搬到 `.codeflow/` 标准目录 | P2 | 与 §3.2 `brief_dir` 标准化同步 |
| 9 | README.md / .en.md / .zh.md 顶部嵌入精简版宪法块 | P1 | **建议本周做**（与 §0.0 同步生效） |
| 10 | `codeflow-overview.md` / `.en.md` 顶部嵌入精简版宪法块 | P1 | 同上 |

PM 想征求 ADMIN 一个意向（不是决策门槛）：**#9 + #10 是否现在就做？**

理由：你刚给的两条总纲句目前只在设计文档里有正式引用。但设计文档是 *内部源真相*；外部读者第一眼看的是 README + overview。如果你希望"任何打开这个仓的人第一眼就被这两句宪法击中"，#9/#10 应该立刻做（约 15 分钟）。如果你觉得"先攒着等 v0.1 closed beta 一起改"，就排到下个 sprint。

## 待 ADMIN 决策的事项（与上一轮同步，不变）

1. **是否现在让 PM 用 `gh issue create` 推 D:\FCoP Issue**（昨晚 Option A 已拍板，等你 *再点一次头* 我就推；这是 TASK-20260509-003 留下的二次确认门槛）
2. **#9 + #10 立刻做 vs 攒到 v0.1 beta**（见上）
3. **`docs/integrations/fcop-standalone-zh.md` 立刻重写 vs 等 v0.2**（见 §8.6 backlog #4）

PM 默认动作：等 ADMIN 回复或下一条指令再走。

## 文件清单（本轮新增/修改）

- 修改：`docs/design/codeflow-v2-on-fcop-sdk.md`（+ §0.0 宪法块、§8.0 #2 措辞、§8.0 5.b 表、§8.1 ASCII、§8.2 节首+2 行、§8.5 时间表、新增 §8.6）
- 新增：`docs/agents/tasks/REPORT-20260509-008-PM-to-ADMIN.md`（本文件）

PM-01 待命。
