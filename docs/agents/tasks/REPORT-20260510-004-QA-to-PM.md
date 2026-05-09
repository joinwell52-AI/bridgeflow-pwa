---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260510-004
sender: QA
recipient: PM
priority: P1
thread_key: codeflow-v0.2-acceleration-test-fixtures-and-strategy
references:
  - TASK-20260510-004-PM-to-QA
  - REPORT-20260509-031-QA-to-PM
layer: governance
---

# REPORT-20260510-004：v0.2 加速冲刺 — QA 预备 fixture + 验收策略（完成）

## 一、一句话结论

**TASK-20260510-004 三项工作全部完成。** `test-strategy-v0.2-acceleration.md` 已就绪，
4 套 fixture 目录已创建（含 3 个新增），ADMIN v0.1.0-rc.1 试用暂无 bug 反馈（Item 3 N/A）。
QA 已进入"随时拼接"模式，DEV 每阶段交付即可立即验收。

---

## 二、工作完成情况

### Item 1：`docs/test-strategy-v0.2-acceleration.md`（新建）

**状态：✅ 完成**

文档结构：
- §0 背景与目标（4 版本时间线）
- §1 验收总原则（文件协议 / 无阻塞上线 / 基线回归要求）
- §2 v0.1.0-rc.1 基线回归清单（BL-01~04，每版本必跑）
- §3 v0.2.0-alpha 验收清单（A-01~A-14，SDK 集成 + ConfigLoader 优先级）
- §4 v0.2.0-beta 验收清单（B-01~B-11，EXE 冷启动 + 治理 + 退出 + 性能）
- §5 v0.2.0-rc.1 验收清单（R-01~R-13，relay 连接 + inbox 注入 + 回传）
- §6 v1.0-rc.1 验收清单（S-01~S-19，7 schemas + 向后兼容 + boundary 强约束）
- §7 跨版本回归矩阵（5 版本 × 5 检查项）
- §8 Bug 报告规范（severity / version / steps / regression）
- §9 变更历史

检查清单总计：**基线 4 + alpha 14 + beta 11 + rc.1 13 + v1.0 19 = 61 条**

### Item 2：`codeflow-shell/examples/` fixture 目录

**状态：✅ 完成**

| 目录 | 文件 | 状态 |
|---|---|---|
| `hello-world/` | README.md + sample-task.md | 已有，保留 |
| `real-sdk-smoke/` | README.md + sample-task-with-cursor-sdk.md | ✅ 新建 |
| `relay-bridge-smoke/` | README.md + wscat-payload-command.json + expected-task-event.json | ✅ 新建 |
| `boundary-violation-smoke/` | README.md + sample-task-violating-boundary.md | ✅ 新建 |

各 fixture 说明：

**real-sdk-smoke**：包含带 `CURSOR_API_KEY` 场景的简单代码审查任务（函数重命名），
能驱动真实 LLM 产出 VERDICT。README 含 4 种失败情形。

**relay-bridge-smoke**：`wscat-payload-command.json` 为标准 FCoP relay 事件格式
（`event_type: task_create`），`expected-task-event.json` 定义回传消息字段。
README 含双终端操作步骤。

**boundary-violation-smoke**：`sample-task-violating-boundary.md` 在 YAML front-matter
内嵌 `boundary.can / cannot` 定义，`push_to_production` 明确列为 cannot，
预期触发 `BOUNDARY_VIOLATED` → NeedsHumanGate 路径。

### Item 3：ADMIN v0.1.0-rc.1 试用反馈 → BUG 收集

**状态：N/A（截至本报告时间，ADMIN 未反馈具体 bug）**

ADMIN 已开始试用（per REPORT-20260510-002-PM-to-ADMIN），
如有任何异常，QA 在收到描述后 1h 内产出 BUG 回执（REPORT-20260510-XXX-QA-to-PM）。

---

## 三、验收策略摘要（供 PM 转 ADMIN 参考）

| 版本 | 关键验收条件 | 预计验收时间 |
|---|---|---|
| v0.2.0-alpha | BL-01~04 + A-01~A-06（无需真实 key） | DEV 交付后 ≤2h |
| v0.2.0-alpha（真实 SDK） | A-07~A-10（需 ADMIN 提供 key） | 与 alpha 同批或 +1h |
| v0.2.0-beta | BL-01~04 + B-01~B-09 | DEV 交付后 ≤2h |
| v0.2.0-rc.1 | BL-01~04 + R-01~R-13 | DEV 交付后 ≤3h |
| v1.0-rc.1 | BL-01~04 + S-01~S-19 + 跨版本矩阵 | DEV 交付后 ≤4h |

---

## 四、已知偏差和前置注意事项

1. **Surprise 1（SEA EXE）**：若 v0.2.0-beta EXE 打包失败，验收清单 B-01/B-02 降级为 `npm start` fallback 模式，已在 §4 注明。
2. **Surprise 2（Windows SIGINT）**：非交互式自动化测试 Ctrl+C 信号不可靠，退出测试依赖交互式手动或代码审查，已在 §4 注明。
3. **real-sdk-smoke A-07~A-10**：需要 ADMIN 提供有效 `CURSOR_API_KEY` 才可执行，QA 可先执行无 key 部分（A-01~A-06）。
4. **relay-bridge-smoke**：需 relay 服务运行中（`ai.chedian.cc` 或本地中继），若 OPS 尚未完成 relay 部署验证（TASK-20260510-003-PM-to-OPS），可暂缓。

---

## 五、文件变更清单

| 文件 | 操作 |
|---|---|
| `docs/test-strategy-v0.2-acceleration.md` | 新建（61 条检查清单，9 个章节） |
| `codeflow-shell/examples/real-sdk-smoke/README.md` | 新建 |
| `codeflow-shell/examples/real-sdk-smoke/sample-task-with-cursor-sdk.md` | 新建 |
| `codeflow-shell/examples/relay-bridge-smoke/README.md` | 新建 |
| `codeflow-shell/examples/relay-bridge-smoke/wscat-payload-command.json` | 新建 |
| `codeflow-shell/examples/relay-bridge-smoke/expected-task-event.json` | 新建 |
| `codeflow-shell/examples/boundary-violation-smoke/README.md` | 新建 |
| `codeflow-shell/examples/boundary-violation-smoke/sample-task-violating-boundary.md` | 新建 |

---

## 六、PM 待处理事项

| 序号 | 事项 | 优先级 |
|---|---|---|
| 1 | 通知 OPS 将本次新增 fixture + 测试策略文件纳入下次提交 | P2 |
| 2 | ADMIN 试用 v0.1.0-rc.1 时，将任何异常描述发给 QA | P1 |
| 3 | 确认 v0.2.0-alpha 验收中，是否能提供有效 `CURSOR_API_KEY`（用于 A-07~A-10）| P1 |
| 4 | DEV 每阶段交付后，发送 `TASK-YYYYMMDD-XXX-PM-to-QA.md` 触发 QA 验收 | P0 |

QA-01 已就绪，待 PM 下一步指令。

QA-01
2026-05-10 01:30 (UTC+8)
