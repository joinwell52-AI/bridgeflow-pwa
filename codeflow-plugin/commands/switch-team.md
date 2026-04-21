---
name: switch-team
description: Switch FCoP team template without losing existing data
---

# 切换团队模板 / Switch Team Template

切换团队模板会更新角色配置，但不会删除已有的任务和报告文件。
Switching the team template updates role configuration but preserves existing tasks and reports.

## 步骤 / Steps

1. 查看可用模板：调用 `get_available_teams` 工具
2. 重新初始化：调用 `init_project(team="新模板名")`
3. 新的角色配置会写入 `docs/agents/fcop.json`，旧的任务文件保留

## 注意 / Notes

- 切换模板后，旧任务单中的角色代码不会自动更新
- 建议先将旧任务归档（`archive_task`），再切换模板
- 切换后需要重新为各 Agent 窗口分配对应的角色
- FCoP 协议规则与协议解释文件不受影响（`fcop-rules.mdc` / `fcop-protocol.mdc` 由 `fcop` 包版本控制，不由团队模板控制）
