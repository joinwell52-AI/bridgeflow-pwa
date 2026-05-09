# boundary-violation-smoke — Boundary 强约束冒烟测试

## 用途

用于验证 v1.0-rc.1 阶段的 Boundary 强约束机制。
当 task 请求的操作违反 `boundary.cannot` 定义时，
应触发 `BOUNDARY_VIOLATED`，并经由 `NeedsHumanGate` 记录到 review 文件。

## 前置条件

1. CodeFlow v1.0-rc.1 或以上版本（含 boundary schema + BoundaryViolationError）
2. CodeFlow 已启动

## 使用步骤

```powershell
# 启动 CodeFlow（v1.0-rc.1）
cd codeflow-shell
npm start

# 在另一个终端，drop 触发违规的 fixture
copy examples\boundary-violation-smoke\sample-task-violating-boundary.md "$env:USERPROFILE\.codeflow\v2\inbox\"
```

## 预期结果

1. `InboxWatcher` 检测到 task 文件
2. `TaskParser` 解析成功（YAML front-matter 合法）
3. `TaskDispatcher` 创建会话，agent 尝试执行 `boundary.actions` 中的操作
4. `BoundaryValidator` 检测到违规（操作在 `boundary.cannot` 列表中）
5. 抛出 `BoundaryViolationError` 或 `BOUNDARY_VIOLATED`
6. `NeedsHumanGate` 收到 `reason: BOUNDARY_VIOLATED` 并触发
7. `ReviewWriter` 将含 `BOUNDARY_VIOLATED` 关键字的 review 写入 `<dataDir>/reviews/`
8. 若 relay 在线，relay 收到含 `boundary_violated` 的事件消息

## 核查要点

- `<dataDir>/reviews/` 下出现 `REVIEW-*.md`
- review 文件内容含 `BOUNDARY_VIOLATED`
- 进程未崩溃（Boundary 违规是受控错误，不是 unhandled exception）

## 失败情形

| 现象 | 可能原因 |
|---|---|
| 进程崩溃（unhandled）| BoundaryViolationError 未被 catch |
| review 文件不含 `BOUNDARY_VIOLATED` | ReviewWriter 未传递 reason |
| 无任何日志输出 | BoundaryValidator 未注册到 Runtime |
| 治理循环跳过 boundary 检查 | TaskDispatcher 未接入 BoundaryValidator |
