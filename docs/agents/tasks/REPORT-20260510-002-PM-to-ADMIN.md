---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260510-002
sender: PM
recipient: ADMIN
priority: P0
thread_key: codeflow-v0.2-acceleration-roadmap
references:
  - REPORT-20260510-001-PM-to-ADMIN
  - TASK-20260510-002-PM-to-DEV
  - TASK-20260510-003-PM-to-OPS
  - TASK-20260510-004-PM-to-QA
  - docs/design/v0.2-sprint0-roadmap.md
layer: governance
---

# REPORT-20260510-002：加速推进路线图（v0.1 → v1.0 公开发布）

## §一 接令

ADMIN 5/10 01:00「**加快吧，加速推进！！！**」三个感叹号 = 容忍可控风险换时间。

PM 已切换到加速节奏，3 TASK 同步派出。**新里程碑：v1.0 5/27 公开发布（比原计划 6/10 提前 14 天）**。

---

## §二 加速对策（5 lane 并行）

| Lane | 担纲 | 内容 | 工期 |
|---|---|---|---|
| **A** v0.2 sprint 0 4 阶段串行 | DEV-01 | P1 真 SDK + P2 EXE + P3 relay-bridge + P4 7 schemas | 5/11-5/22（10 工作日）|
| **B** 公网 relay 健康验证 + 部署预案 | OPS-01 | 验证 ai.chedian.cc 在线 + spike-v2-deploy.md | 5/10（≤ 1h）|
| **C** 测试 fixture + 跨版本策略 | QA-01 | test-strategy-v0.2-acceleration.md + 4 套 fixture | 5/10-5/11（≤ 3h）|
| **D** 上游同步 + docs 维护 | PM-01 | 监听 fcop@1.0 final + design doc 更新 + ADMIN 通报 | 持续 |
| **E** ADMIN 试用 v0.1.0-rc.1 反馈收集 | QA-01 + ADMIN | 任何问题立即 BUG report → PM 派 patch | 5/10-5/15 |

---

## §三 加速版时间盘

```
5/10 (今天)   ┃ 派 3 TASK + 写 REPORT-002 ✅
              ┃ ADMIN 在 OPS/DEV/QA session 各打 1 次「巡检 开工」
              ┃
5/11 EOD      ┃ DEV: v0.2.0-alpha（真 SDK 接入 + ConfigLoader）
              ┃ OPS: REPORT-003 + spike-v2-deploy.md ✅
              ┃ QA:  REPORT-004 + 4 套 fixture + test-strategy ✅
              ┃
5/12 EOD      ┃ DEV: v0.2.0-beta（EXE 打包评估 + 第一个 EXE）
              ┃ QA:  v0.2.0-alpha verify pass
              ┃
5/13-5/14     ┃ DEV: P3 relay-bridge MVP 编码
              ┃ QA:  v0.2.0-beta verify pass
              ┃ PM:  daily fcop upstream 监听
              ┃
5/14 EOD      ┃ DEV: ★ v0.2.0-rc.1 internal preview（含真 SDK + EXE + relay）
              ┃ OPS: docs commit + 本地 tag (不推 origin)
              ┃ QA:  E2E 全栈跑通（手机 wscat 模拟 → relay → v2 → 真 SDK → 评审）
              ┃ PM:  REPORT-PM-to-ADMIN「v0.2.0-rc.1 出炉」+ 试用引导
              ┃
5/15-5/21     ┃ DEV: P4 7 schemas 重写 + Boundary 升级（5-6 工作日）
              ┃ PM:  跟踪 fcop@1.0 final 落 PyPI（5/16-5/20 上游窗口）
              ┃
5/22 EOD      ┃ DEV: ★ v1.0-rc.1 internal preview
              ┃ QA:  v1.0 全面回归 + 7 schemas + Boundary 验证
              ┃
5/23-5/24     ┃ ADMIN 试用 v1.0-rc.1
              ┃ QA:  跨版本回归（v0.1 → v0.2 → v1.0 三档兼容）
              ┃
5/25-5/26     ┃ ADMIN 拍板：v1.0 公开发布范围（npm + GitHub Release + Gitee？）
              ┃ DEV: 准备 RELEASE-NOTES.md
              ┃
5/27 EOD      ┃ ★★★ v1.0 公开发布
              ┃ - npm publish @codeflow/runtime + @codeflow/protocol + codeflow-shell
              ┃ - GitHub Release + tag 推 origin
              ┃ - codeflow-pwa 同步 v1.0 alignment（手机端可下达任务）
              ┃ - Gitee 镜像
```

**比原计划（6/10 公开发布）提前 14 天**。

---

## §四 关键决策点（PM 自决 + ADMIN 知情 / 待 ADMIN 拍板）

### D1（自决，第 5 总纲）：不等 fcop@1.0 final，用 RC.1 直开干

- **风险**：上游 RC.1 → final 之间还有 breaking change
- **缓解**：DEV-002 P4 期间 daily 跟踪 upstream + rebase 一次（PM 自约束 §条款 2 已含「主动跟踪上游」）
- **PM 处置**：自决执行 ✅（ADMIN「加快」隐含批准）

### D2（自决，第 5 总纲）：v0.2.0-rc.1 / v1.0-rc.1 internal RC tag 不推 origin（与 v0.1.0-rc.1 同策略）

- **理由**：internal RC = 仅供 ADMIN 内测；公开 tag 等 5/27 v1.0 final 一次性推
- **PM 处置**：自决执行 ✅

### D3（自决，第 5 总纲）：DEV 单线串行 4 阶段（P1 → P2 → P3 → P4）

- **风险**：5/22 死线对 DEV-01 单人压力大
- **缓解**：P1 → P2 → P3 是连续渐进的，每 1-1.5 工作日出一个内部版本（v0.2.0-alpha → -beta → -rc.1），任何卡点立即出 BLOCKER 回执
- **PM 处置**：自决执行 ✅

### D4（**请 ADMIN 拍板**，资源决策）：是否新增 DEV-02 cursor session 实现真正并行

- **方案 A**：保持 DEV-01 单线（当前默认）— 5/22 出 v1.0-rc.1
- **方案 B**：ADMIN 在桌面新开一个 cursor session 命名 DEV-02，PM 把 P2 (EXE) + P3 (relay-bridge) 转给 DEV-02 并行做 — 5/19 出 v1.0-rc.1（**再提前 3 天**）
- **PM 推荐**：**方案 A**（单 DEV 已能 5/27 公开发布，扩 DEV-02 只省 3 天但增加 merge conflict 与协调成本）
- **ADMIN 不表态 = 默认方案 A**（按第 5 总纲）

### D5（**5/25 临近时再请 ADMIN 拍板**）：v1.0 公开发布范围

- **范围 A**：仅 npm publish（最小公开，可控）
- **范围 B**：npm + GitHub Release + Gitee 镜像（推荐，全平台覆盖）
- **范围 C**：B + 写一篇博客 + 投 Hacker News / 微博（公关层面，PM 推荐 v1.1 再做）
- **PM 推荐**：**范围 B**（5/25 再请示，现在不动）

---

## §五 已派 TASK 清单（同步 5/10 01:00）

| 文件 | 接收 | 优先级 | 工期 | 状态 |
|---|---|---|---|---|
| [TASK-20260510-002-PM-to-DEV](TASK-20260510-002-PM-to-DEV.md) | DEV-01 | P0 | 10 工作日（5/11-5/22）| 待 DEV 接单 |
| [TASK-20260510-003-PM-to-OPS](TASK-20260510-003-PM-to-OPS.md) | OPS-01 | P1 | ≤ 1h | 待 OPS 接单 |
| [TASK-20260510-004-PM-to-QA](TASK-20260510-004-PM-to-QA.md) | QA-01 | P1 | ≤ 3h | 待 QA 接单 |
| [TASK-20260510-001-PM-to-OPS](TASK-20260510-001-PM-to-OPS.md)（前一轮）| OPS-01 | P1 | ≤ 5min | 待 OPS 接单（v0.1 closing docs commit）|

**ADMIN 待办**：在 **DEV / OPS / QA cursor session 各打 1 次「巡检 开工」**（v0.1 doorbell phenomenon 还在；v0.2 sprint 完成 P3 relay-bridge 后 cross-session notification 闭环）。

---

## §六 风险一览

| # | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| R1 | fcop@1.0-rc.1 → final 还有 breaking change | 中 | P4 多 1-2 工作日 rebase | daily 跟踪 + 集中 rebase |
| R2 | 真 Cursor SDK 接入需 ADMIN API key | 高 | P1 完工但 QA 无法验真 SDK | 5/11 EOD PM 找 ADMIN 拿 key |
| R3 | EXE 三方案都失败 | 低 | 退 npm start + npx 启动 | 已含 fallback |
| R4 | relay-bridge ↔ PWA v2.4.65 协议偏差 | 中 | P3 降级处理 | OPS-003 先验证协议 |
| R5 | DEV-01 单线扛 10 工作日疲劳 | 中 | 5/22 死线滑 | D4 留 ADMIN 决策窗口 |
| R6 | ADMIN 试用 v0.1.0-rc.1 发现严重 bug | 低 | 紧急 v0.1.0-rc.2 patch | QA-004 Item 3 已含 BUG report 通道 |

---

## §七 PM 自约束审计（本轮加速决策）

按 §0.0 第 5 总纲：

| 决策 | 性质 | 处置 |
|---|---|---|
| 切换到加速节奏（5 lane 并行）| 重大变更 | ✅ ADMIN 5/10 01:00「加快」明确批准 |
| D1 不等 fcop@1.0 final | 路线策略变更 | ✅ 「加快」隐含批准 = 容忍 R1 风险 |
| D2 v0.2/v1.0 RC tag 不推 origin | 常规推荐 | ✅ 自决（与 v0.1.0-rc.1 同策略）|
| D3 DEV 单线串行 4 阶段 | 常规推荐 | ✅ 自决 |
| D4 是否扩 DEV-02 | 资源变更 | ❌ **上交 ADMIN**，PM 推荐方案 A |
| D5 v1.0 公开范围 | 重大变更 | 🚧 5/25 临近时再请示 |
| 派 3 TASK | 常规推荐 | ✅ 自决 |

→ 本轮 1 项上交（D4）+ 5 项自决 + 1 项延后请示。

---

## §八 一句话送 ADMIN

> 路线已切换。**5/10-5/14 出 v0.2.0-rc.1（真 SDK + EXE + relay-bridge）让你试用**；
> **5/22 出 v1.0-rc.1（fcop@1.0 alignment 完成）；5/27 v1.0 公开发布**。
>
> 你要做的只剩 4 件事：
>
> 1. **去 DEV / OPS / QA cursor session 各打 1 次「巡检 开工」**（启动本轮）
> 2. **5/11 EOD 给 PM 一个 Cursor API key**（验真 SDK；可发到 ADMIN-to-PM TASK 文件里）
> 3. **回 D4**（默认方案 A 单 DEV，按第 5 总纲不回 = 默认；要扩 DEV-02 就回 D4=B）
> 4. **试用 v0.1.0-rc.1**（任何问题写到 ADMIN-to-PM TASK 文件，QA-004 Item 3 通道接收）

PM-01
2026-05-10 01:00 (UTC+8)
