---
name: init-team
description: Initialize an FCoP collaboration workspace with a team template
---

# 初始化 FCoP 团队 / Initialize FCoP Team

使用 `fcop` MCP 的 `init_project` 工具来初始化项目协作空间。
Use the `init_project` tool from the `fcop` MCP to initialize the collaboration workspace.

## 步骤 / Steps

1. 调用 `init_project` 工具，传入团队模板参数
2. 可选模板：
   - `dev-team` — 软件开发团队（PM, DEV, QA, OPS）
   - `media-team` — 自媒体团队（PUBLISHER, COLLECTOR, WRITER, EDITOR）
   - `mvp-team` — 创业 MVP 团队（MARKETER, RESEARCHER, DESIGNER, BUILDER）
3. 工具会自动：
   - 创建 `docs/agents/` 目录结构
   - 写入 `docs/agents/fcop.json`（项目身份配置）
   - 部署 `.cursor/rules/fcop-rules.mdc`（FCoP 协议规则，`alwaysApply: true`）
   - 部署 `.cursor/rules/fcop-protocol.mdc`（FCoP 协议解释，`alwaysApply: true`）
   - 生成一条欢迎任务给 leader

## 示例 / Example

```
请帮我初始化一个软件开发团队的协作空间
Please initialize a software development team workspace for me
```

等价于调用 / Equivalent to：`init_project(team="dev-team")`
