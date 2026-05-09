---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-007
sender: PM
recipient: ADMIN
priority: P0
thread_key: codeflow-pwa-rule5-purge-fcop-definitions
references:
  - REPORT-20260509-003-PM-to-ADMIN
  - TASK-20260509-006-PM-to-DEV
  - REPORT-20260509-006-DEV-to-PM
---

# 硬规则 #5 已物理落地 — 本仓"fcop 定义/分发"内容已清零

## ADMIN 指令复述（5/9 10:38–10:42）

> 1. 「本地的 fcop 已经抽离了，fcop 独立了；我们就是安装 fcop-mcp 啊」
> 2. 「我们现在这个码流项目，就是应用 fcop-mcp；不是定义 fcop！」
> 3. 「还需要什么确认？就是删除现在项目中有关 fcop 定义的内容？」（反问 = 确认 + 不要再问）

PM 解读：本仓 = 应用方/消费方/下游；fcop 定义/分发 = D:\FCoP 上游仓的事。这是继前两条身份级硬规则之后的**第三条**。

## 已完成（不可逆动作，用 1 屏说清）

| # | 动作 | 验证 |
|---|---|---|
| 1 | 删 `fcop-mcp/` 整个目录 | Test-Path = False |
| 2 | 删 `codeflow-plugin/src/` 整个目录（fcop 包源码副本 + _data + server.py） | Test-Path = False |
| 3 | 删 `codeflow-plugin/mcp.json` | Test-Path = False |
| 4 | 删 `codeflow-plugin/scripts/install-fcop.{ps1,sh}` | Test-Path = False |
| 5 | 删 `codeflow-plugin/pyproject.toml`（占着 PyPI 包名 `fcop`） | Test-Path = False |
| 6 | 删 `codeflow-plugin/.cursor-plugin/plugin.json`（占着 `fcop` 名） | Test-Path = False |
| 7 | 删 `codeflow-plugin/requirements.txt` | Test-Path = False |
| 8 | 删 `codeflow-plugin/README.md`（"如何安装 fcop MCP" 教程） | Test-Path = False |
| 9 | `@codeflow/protocol` 测试 | 8/8 PASS（5 valid + 3 expected-invalid） |

## 保留（按 §8.2 / §5.c）

`codeflow-plugin/agents/` + `templates/` + `skills/file-protocol/` + `commands/` + `hooks/hooks.json` + `scripts/on_file_edit.py` 全部完整。`docs/integrations/fcop-standalone-zh.md` 暂留（措辞落后于 v2 身份，下次 sprint 修订）。

## 还有 6 项 backlog（PM 自行排，**不再问 ADMIN**）

| # | 项 | 优先级 |
|---|---|---|
| 1 | `docs/design/codeflow-v2-on-fcop-sdk.md` §8.0 加硬规则 #5（之前被打断的 `StrReplace`） | P0 |
| 2 | 同文档 §8.2 表中"fcop-mcp/" 与 "codeflow-plugin/src/fcop/" 行更新为 ❌ 已删除 | P1 |
| 3 | `docs/integrations/fcop-standalone-zh.md` 按 v2 身份重写 | P1 |
| 4 | `codeflow-plugin/` 剩余资产是否搬到 `.codeflow/` 标准目录 | P2 |
| 5 | `_ignore/audit_fcop_project.{json,py}` / `audit_legacy_fcop.{json,py}` 是否清理 | P2 |
| 6 | `CHANGELOG.md` / `docs/release-process.md` 是否提及 fcop 子目录退役 | P2 |

PM 下一步打算：把 #1 立刻做了（同会话内就能做完），#2/#3 下个 sprint 节点处理，#4–#6 攒到下次 ADMIN 决策点一并报。

## 影响 ADMIN 的部分

| 维度 | 状况 |
|---|---|
| 你今天还能不能用 fcop-mcp | ✅ 能。你电脑上的 `D:\FCoP` 仓和已发的 PyPI `fcop-mcp 0.6.x` 完全没动 |
| Cursor 里 `mcp.json` 配置 | ⚠️ 如果你 Cursor 之前用 `d:\Bridgeflow\codeflow-plugin\mcp.json` 软链/复制——现在该 mcp.json 已删；请改读 `D:\FCoP` 上游仓提供的 mcp.json 模板 |
| CodeFlow Desktop / PWA / Relay | ✅ 0 影响 |
| `@codeflow/protocol` / `@codeflow/runtime`（v2 工程） | ✅ 0 影响（已通过测试） |
| FCoP Issue 提案（昨晚 ADMIN 拍板的 Option A） | 📌 `_ignore/fcop-issue-draft.md` 已就绪；下一道 ADMIN 决策门槛 = 是否现在让 PM 用 `gh issue create` 推到 D:\FCoP 仓 |

## 自检

- ✅ 删除清单 9 项全 False / 保留资产 6 项全 True
- ✅ `npm test --silent`（in `packages/codeflow-protocol`）8/8 通过
- ✅ 全程未触碰 `D:\FCoP` 上游仓
- ✅ 全程未碰生产服务、未改 Nginx、未清数据库（无 OPS-01 介入需要）
- ✅ 任务派单（TASK-006）+ DEV 回执（REPORT-006）+ PM 总结（本文件）三件齐全，完全合规 PM-01/DEV-01 协议
- ✅ 新增任务文件命名 `TASK-YYYYMMDD-序号-发送方-to-接收方.md` 一致

## 下一步

PM 立刻去做 backlog #1（§8.0 加硬规则 #5），不需要 ADMIN 再批准——这是 ADMIN 5/9 10:38 已经直接命令、5/9 10:42 反问语气再次确认的。完成后会另起一个回执 `REPORT-20260509-008-PM-to-ADMIN.md`。

如果 ADMIN 想此刻同时拍板"是否推 D:\FCoP Issue"，请直接告知；否则 PM 默认按昨晚 Option A 排队，等 backlog #1 落完再请你最后点头。
