# real-sdk-smoke — Cursor SDK 真实接入冒烟测试

## 用途

用于验证 v0.2.0-alpha 阶段的 Cursor SDK 真实接入。
当 `CURSOR_API_KEY` 设为有效值时，CodeFlow 应使用真实 LLM adapter，
而非 InMemorySdkAdapter（fake）。

## 前置条件

1. CodeFlow 已启动（`npm start` 或 EXE）
2. 环境变量 `CURSOR_API_KEY` 已设为 ADMIN 提供的有效 key
3. 网络可达 Cursor API

## 使用步骤

```powershell
# 1. 设置 API key
$env:CURSOR_API_KEY = "<ADMIN 提供的真实 key>"

# 2. 启动 CodeFlow（确认 banner 中出现 adapter=cursor-sdk 或类似提示）
cd codeflow-shell
npm start

# 3. 在另一个终端，drop 测试 fixture
copy examples\real-sdk-smoke\sample-task-with-cursor-sdk.md "$env:USERPROFILE\.codeflow\v2\inbox\"
```

## 预期结果

- stdout 含 VERDICT 行（`approve` / `reject` / `needs_human` 之一）
- 若 verdict=needs_human → `[NeedsHumanGate]` 触发 + review 文件写入
- 若 verdict=approve  → 无 `[NeedsHumanGate]` 输出

## 失败情形

| 现象 | 可能原因 |
|---|---|
| 仍走 `InMemorySdkAdapter` | sdk-factory.ts 未读取 `CURSOR_API_KEY` |
| 进程崩溃 | SDK 初始化异常未 catch |
| 无任何 VERDICT 输出 | SessionManager 未等待 SDK 返回 |
| 超过 30s 无响应 | Cursor API 超时，需增加 timeout 设置 |
