# FCoP — 软件开发团队 / Software Development Team

> **主控角色（leader）：PM** | 各模板对比：dev-team=PM / mvp-team=MARKETER / media-team=PUBLISHER / qa-team=LEAD-QA

## 团队构成 / Roles

| 角色 | 代码 | 职责 |
|------|------|------|
| 项目经理 | PM | 任务分发、进度跟踪、归档管理 |
| 开发工程师 | DEV | 编码实现、Bug 修复 |
| 测试工程师 | QA | 功能测试、回归验证 |
| 运维工程师 | OPS | 部署发布、环境维护 |

## 协作流程 / Flow

```
PM 分配任务 → DEV 开发 → QA 测试 → OPS 部署
     ↑                              |
     └──── 完成报告 / Bug 反馈 ────┘
```

> 本模板遵循 FCoP Rule 4（角色链路）：`ADMIN ↔ PM` 是唯一对外接口；`DEV / QA / OPS` 只从 `PM` 接收任务、只向 `PM` 回执。

## 快速开始 / Quick Start

1. 开 4 个 Cursor Agent 窗口
2. 每个窗口分配一个角色（告诉它"你是 PM 在 dev-team"）
3. 对 PM 说"开始工作"
4. PM 会自动巡检 tasks/ 目录，开始分配任务
