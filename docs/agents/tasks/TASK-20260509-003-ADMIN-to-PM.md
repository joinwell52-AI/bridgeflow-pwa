---
protocol: fcop
version: 1
kind: task
task_id: TASK-20260509-003
sender: ADMIN
recipient: PM
priority: P1
thread_key: codeflow-v2-runtime-protocol-design
references:
  - REPORT-20260509-001-DEV-to-PM
  - _ignore/fcop-publish-proposal.md
---

# 三项拍板：D:\FCoP 逆向贡献提案立刻执行

## 背景

DEV-01 在 `REPORT-20260509-001-DEV-to-PM.md` 第二节暴露了「§3 已写但 D:\FCoP 未 review」的 5 字段协议负债（`Agent.layer` / `Task.risk_level` / `Review.decision=needs_human` / `Review.human_approval` / `Skill.tools` risk meta）。PM 在 `_ignore/fcop-publish-proposal.md` 给出 3 项决策清单等 ADMIN 拍板。

ADMIN 在 5/9 01:58 给出答复（结构化选项收集）。

## 三项拍板

### Q1（推送时机）→ Option A：S2 派单后立刻推

S2 设计骨架与 D:\FCoP 评审并行；S3 实现期就能用上 fcop@1.1。理由 = fcop 1.0 还没冻结，正好是改 spec 的窗口期；早暴露早还协议负债。

### Q2（执行人）→ PM 直接提 Issue

PM-01 自己在 D:\FCoP 仓提 Issue（不写代码、只发讨论）；后续如果需要开 PR 再拉 OPS 单。
不走"拉 OPS 单去 D:\FCoP 工作树"路径——理由：本阶段只是发讨论征求 spec 维护者意见，没有代码改动，不需要 OPS 部署纪律。

### Q3（范围）→ 5 个 ADR 一次全推

5 个字段打包成一个伞 Issue 推送，目标版本 `fcop@1.1.0` + `fcop-mcp@1.1.0`。
不走"先做关键 3 个"——理由：5 个字段在 v2 的设计文档里是一套整体（治理 + 风险 + Review 转人 + 人审记录 + Skill 风险元数据），互相引用强；分批推会让 spec 维护者重复 review 同一套语义。

## 给 PM 的执行约束

1. **本指令落档后，PM-01 立刻按 PM-01 规则写接单回执** `TASK-20260509-004-PM-to-ADMIN.md`，含执行时间表与下一刀动作清单。
2. **真正提交 D:\FCoP Issue 之前，必须再过一道 ADMIN 确认** —— 在 `_ignore/fcop-issue-draft.md` 准备好 Issue body 完整内容（标题 + body markdown），让 ADMIN 阅读后再用 `gh issue create` 实际推送。这是按"对公仓发布 = 高危操作"原则的二次确认，与 OPS-01 规则等价。
3. **本仓 `packages/codeflow-protocol/` 的 schema 文件保持原样**，不要因为这次拍板就提前改——必须等 D:\FCoP 那边 review 通过 + 发版 + 本仓再镜像（按 §8.0 硬规则 #4 + §3.3.1.b 5 步流程图）。
4. **Sprint S2（TASK-002）独立执行**，与本提案并行，不互为前置。即使 D:\FCoP 5 ADR 全部被打回，S2 的 Agent Registry / Session Manager 接口设计仍然有价值。

## 验收

PM 接单回执（TASK-004）落档 + Issue 草稿（_ignore/fcop-issue-draft.md）落档后，本指令验收完成。
后续 D:\FCoP 那边的 review/PR/发版进展，分别由独立 task_id 追踪。
