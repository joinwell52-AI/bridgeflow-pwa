# 码流（CodeFlow）— 专项测试团队

> **主控角色：LEAD-QA**（接收 PM 任务，分发给团队，汇总测试结论）

## 团队构成

| 角色 | 代码 | 职责 |
|------|------|------|
| 测试负责人 | LEAD-QA | 统筹策略、任务分发、质量决策 |
| 功能测试 | TESTER | 手工功能测试、回归验证 |
| 自动化测试 | AUTO-TESTER | 自动化脚本编写与执行 |
| 性能测试 | PERF-TESTER | 压测、性能指标分析 |

## 协作流程

```
PM → LEAD-QA → TESTER / AUTO-TESTER / PERF-TESTER
                          ↓
               LEAD-QA 汇总 → PM
```

## 与其他模板的主控对比

| 模板 | 主控角色 |
|------|------|
| dev-team | 01-PM |
| mvp-team | 03-MARKETER |
| media-team | PUBLISHER |
| qa-team | LEAD-QA |

## 快速开始

1. 开 4 个 Cursor Agent 窗口
2. 每个窗口分配一个角色
3. 对 LEAD-QA 说"开始工作"
4. 由 PM 下达测试任务给 LEAD-QA
