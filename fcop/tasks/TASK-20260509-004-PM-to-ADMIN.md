---
protocol: fcop
version: 1
kind: task
task_id: TASK-20260509-004
sender: PM
recipient: ADMIN
priority: P1
thread_key: codeflow-v2-runtime-protocol-design
references:
  - TASK-20260509-003-ADMIN-to-PM
  - REPORT-20260509-001-DEV-to-PM
  - _ignore/fcop-publish-proposal.md
---

# PM 接单回执：D:\FCoP 5 字段批量提案，已开始准备 Issue 草稿

## 接单确认

✅ 已接单 TASK-20260509-003-ADMIN-to-PM（三项拍板：Option A + PM 直接提 + 5 个 ADR 全推）。
预计完成时间：本会话内完成 Issue 草稿落档 + ReadLints 验证；实际推送 D:\FCoP 待 ADMIN 二次确认后执行。

## 执行计划

按 ADMIN 三项决策拆成 4 个动作：

### 动作 1（本会话内完成）：Issue 草稿落档

新增文件 `_ignore/fcop-issue-draft.md`，含两块内容：
- **Issue 标题**：`Proposal: Runtime governance fields (layer / risk_level / needs_human / human_approval / Skill risk meta) for fcop@1.1`
- **Issue body**：从 `_ignore/fcop-publish-proposal.md` §一动机 + §二 5 字段清单抽取整理成 D:\FCoP 受众可读的形式，含字段定义 / 实证用例 / 兼容性 / 期望版本 / 拆 5 个 ADR 的预算

草稿内容 ADMIN 通过即可推送，不通过则 PM 修改后重新落档。

### 动作 2（待 ADMIN 二次确认后执行）：用 gh 推送 Issue

具体命令（待执行）：

```bash
cd D:\FCoP
gh repo view  # 确认在 joinwell52-AI/FCoP
gh issue create \
  --title "$(cat _ignore/fcop-issue-draft.md | head -1 | sed 's/^# //')" \
  --body-file <(awk '/^## Body/{flag=1; next} /^## /{flag=0} flag' _ignore/fcop-issue-draft.md)
```

（实际执行时会先做 dry-run 让 ADMIN 看一眼最终 payload）

执行后：
- 把 D:\FCoP 那边返回的 Issue URL 写进 `_ignore/fcop-issue-draft.md` 末尾 `posted_at` 字段
- 在本仓 `docs/agents/tasks/` 落 `TASK-20260509-005-PM-to-ADMIN.md` 汇报 Issue URL + 后续 review tracking 计划

### 动作 3（与本提案并行）：S2 任务监控

`TASK-20260509-002-PM-to-DEV.md` 已派出，DEV-01 在做 Agent Registry + Session Manager 设计骨架。预计 S2 回执 `REPORT-20260509-002-DEV-to-PM.md` 落档时间 = ADMIN 决定 DEV-01 何时开工 + 6-8 小时一刀。

如果 S2 回执里发现新的 schema 缺口（譬如 SessionRecord 缺字段），按 ADMIN-003 约束 #3，**不增量改 D:\FCoP Issue**，而是落到下一轮提案（fcop@1.2）。本轮 5 ADR 范围一次定死，避免 D:\FCoP 评审窗口被反复扰动。

### 动作 4（D:\FCoP 那边发版后）：本仓镜像

在 `D:\FCoP` 评审通过 + 发布 `fcop@1.1.0` / `fcop-mcp@1.1.0` 之后：
- 拉 PM-to-DEV 单升级 `packages/codeflow-protocol/` schema 到 `0.1.1`（与 fcop 1.1 等价）
- 跑跨语言 fuzz 测试证明 TS / Python schema 等价
- 更新 `package.json` 的 `peerDependencies`

这一步距今至少 1-2 周（D:\FCoP review 周期 + 发版周期），暂不排期，等真到那个节点再立单。

## 影响范围

| 文件 | 动作 | 状态 |
|---|---|---|
| `docs/agents/tasks/TASK-20260509-003-ADMIN-to-PM.md` | 新增 | ✅ 已落档 |
| `docs/agents/tasks/TASK-20260509-004-PM-to-ADMIN.md` | 新增 | ✅ 本文件 |
| `_ignore/fcop-issue-draft.md` | 新增 | 🔧 PM 接下来立刻产出 |
| `_ignore/fcop-publish-proposal.md` | 不变 | ✅ 作为 Issue 草稿的来源材料保留 |
| `packages/codeflow-protocol/schemas/*.json` | 不变 | ⚠️ 按 ADMIN-003 约束 #3，必须等 D:\FCoP 发版后才能改 |

## 已自检

- ✅ 接单时间在 ADMIN 给出指令后 5 分钟内（符合 PM-01 规则「必须接单回执」时效）
- ✅ 含预计完成时间（本会话内完成草稿）
- ✅ 已拆成 4 个独立动作，每个都有明确触发条件 / 落档文件 / 责任方
- ✅ 没有跳过 ADMIN-003 约束 #2（"提交前必须再过一道 ADMIN 确认"）
- ✅ 没有违反 §8.0 硬规则 #4（本仓 schema 不动）

## 等 ADMIN 拍板的后续节点

只有 1 个：**Issue 草稿（动作 1 完成后的 `_ignore/fcop-issue-draft.md`）是否同意推送**。

PM-01 待命，准备产出 Issue 草稿。
