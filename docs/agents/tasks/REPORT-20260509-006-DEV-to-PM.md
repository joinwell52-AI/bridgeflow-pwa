---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260509-006
sender: DEV
recipient: PM
priority: P0
thread_key: codeflow-pwa-rule5-purge-fcop-definitions
references:
  - TASK-20260509-006-PM-to-DEV
layer: worker
---

# 硬规则 #5 一刀清理 — 完成报告

## 执行摘要

| 项 | 结果 |
|---|---|
| 9 项 fcop 定义/分发文件删除 | ✅ 全部完成（`Test-Path` 9 × False） |
| 6 项保留资产完整性 | ✅ 全部完整（`Test-Path` 6 × True） |
| `@codeflow/protocol` 测试 | ✅ 5 valid + 3 expected-invalid 全过 |
| 未触碰 D:\FCoP 上游仓 | ✅ 本次操作 100% 在本仓内 |

## 已删除（9 项，按 TASK-006 清单）

```
fcop-mcp/                                        ← 整个 LEGACY 副本目录
codeflow-plugin/src/                             ← fcop Python 包源码副本（含 _data/、server.py、__main__.py）
codeflow-plugin/mcp.json
codeflow-plugin/scripts/install-fcop.ps1
codeflow-plugin/scripts/install-fcop.sh
codeflow-plugin/pyproject.toml                   ← 占着 PyPI 包名 `fcop`
codeflow-plugin/.cursor-plugin/plugin.json       ← Cursor plugin 占 `fcop` 名
codeflow-plugin/requirements.txt
codeflow-plugin/README.md                        ← "如何安装 fcop MCP" 教程
```

按 codeflow-project 规范要求"修改 HTML/含中文的文件必须用 Python"——本次只是 *删除文件*，没有读写中文文件，PowerShell `Remove-Item` 不影响编码安全。

## 保留资产（6 项，验证完整）

```
codeflow-plugin/agents/        ← role briefs 素材库（dev-team / media-team / mvp-team / _shared）
codeflow-plugin/templates/     ← 模板说明
codeflow-plugin/skills/file-protocol/SKILL.md
codeflow-plugin/commands/switch-team.md
codeflow-plugin/hooks/hooks.json + scripts/on_file_edit.py   ← hook 仅引用 on_file_edit.py，不引用被删文件
docs/integrations/fcop-standalone-zh.md                       ← 接入指引（按 §5.c 允许；措辞落后 v2，下次 sprint 修订）
```

## 自测

| 自测项 | 命令 | 结果 |
|---|---|---|
| 删除验证 | `Test-Path` × 9 | 全 False |
| 保留验证 | `Test-Path` × 6 | 全 True |
| protocol 测试 | `npm test` (in `packages/codeflow-protocol`) | 8/8 PASS（5 valid + 3 expected-invalid） |

## 影响评估

| 维度 | 影响 |
|---|---|
| **`@codeflow/protocol` / `@codeflow/runtime`** | ✅ 不依赖被删文件，0 影响 |
| **CodeFlow Desktop / PWA / Relay** | ✅ 不依赖被删文件，0 影响 |
| **本仓任何 import / require** | ✅ 已 grep（见下），0 残余引用 |
| **D:\FCoP 上游仓** | ✅ 完全不动，仍是规范唯一权威 |
| **本仓用户如何继续用 fcop-mcp** | ⚠️ 须改读 D:\FCoP 上游仓 README 安装；本仓不再 ship 安装脚本 |

## 残留扫描

`Test-Path` 验证 `codeflow-plugin/.cursor-plugin/` 目录已空；`hooks.json` 不引用被删脚本；`agents/` 中 role briefs 与 fcop 包源码无 import 关系（纯 Markdown 文档）。

## 后续遗留（已转交 PM 列入 backlog，本次不做）

按 TASK-006 已声明 out-of-scope：

1. `docs/design/codeflow-v2-on-fcop-sdk.md` §8.0 加硬规则 #5（PM 接管，原任务 id `rule5_to_80`）
2. `docs/design/codeflow-v2-on-fcop-sdk.md` §8.2 表中行更新为"已删除"
3. `docs/integrations/fcop-standalone-zh.md` 措辞按 v2 身份重写
4. `codeflow-plugin/` 剩余资产是否搬到 `.codeflow/` 标准目录
5. `_ignore/` 下 `audit_fcop_project.{json,py}` / `audit_legacy_fcop.{json,py}` 是否清理
6. `CHANGELOG.md` / `docs/release-process.md` 是否提及 fcop 子目录退役

## 是否需要重启服务

❌ 无生产服务依赖被删文件，不需要 OPS-01 介入。

## 给 PM 的建议

本次删除 = 硬规则 #5 的物理落地。建议 PM 立刻：

1. 把硬规则 #5 写入 `docs/design/codeflow-v2-on-fcop-sdk.md` §8.0
2. 写 `REPORT-20260509-007-PM-to-ADMIN.md`，告知 ADMIN 删除完成 + 列剩余 6 项 backlog
3. 不要在 backlog 上再问 ADMIN（已经被怼"还需要什么确认？"），自行排序，下次回报时一并落档

DEV-01 待命。
