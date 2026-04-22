# FCoP — 专项测试团队 / QA Testing Team

> **主控角色（leader）：LEAD-QA** | 各模板对比：dev-team=PM / mvp-team=MARKETER / media-team=PUBLISHER / qa-team=LEAD-QA

## 团队构成 / Roles

| 角色 | 代码 | 职责 |
|------|------|------|
| 测试负责人 | LEAD-QA | 统筹策略、任务分发、质量决策 |
| 功能测试 | TESTER | 手工功能测试、回归验证 |
| 自动化测试 | AUTO-TESTER | 自动化脚本编写与执行 |
| 性能测试 | PERF-TESTER | 压测、性能指标分析 |

## 协作流程 / Flow

```
PM → LEAD-QA → TESTER / AUTO-TESTER / PERF-TESTER
                          ↓
               LEAD-QA 汇总 → PM
```

> 本模板遵循 FCoP Rule 4（角色链路）：`ADMIN ↔ LEAD-QA` 是唯一对外接口；`TESTER / AUTO-TESTER / PERF-TESTER` 只从 `LEAD-QA` 接收任务、只向 `LEAD-QA` 回执。

## 快速开始 / Quick Start

1. 开 4 个 Cursor Agent 窗口
2. 每个窗口分配一个角色（告诉它"你是 LEAD-QA 在 qa-team"）
3. 对 LEAD-QA 说"开始工作"
4. 由 PM 或 ADMIN 下达测试任务给 LEAD-QA
