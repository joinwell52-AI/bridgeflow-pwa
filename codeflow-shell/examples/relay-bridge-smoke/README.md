# relay-bridge-smoke — relay-bridge MVP 冒烟测试

## 用途

用于验证 v0.2.0-rc.1 阶段的 relay-bridge 功能。
通过 wscat 模拟 PWA（手机端），将 TASK 注入 CodeFlow inbox，
并验证 `task_event` / `agent_status` 回传到 relay。

## 前置条件

1. CodeFlow relay 服务已运行（`wss://ai.chedian.cc/codeflow/ws/` 或本地中继）
2. CodeFlow 已启动，`CODEFLOW_RELAY_URL` 和 `CODEFLOW_ROOM_KEY` 已设
3. `wscat` 已安装：`npm install -g wscat`
4. 用两个终端窗口进行测试

## 使用步骤

### 窗口 1：CodeFlow（接收端）

```powershell
$env:CODEFLOW_RELAY_URL = "wss://ai.chedian.cc/codeflow/ws/"
$env:CODEFLOW_ROOM_KEY  = "<your-room-key>"
cd codeflow-shell
npm start
```

确认 stdout 含 relay connected 日志。

### 窗口 2：wscat（模拟 PWA/手机端）

```bash
wscat -c "wss://ai.chedian.cc/codeflow/ws/?room=<your-room-key>"
```

连接后，粘贴 `wscat-payload-command.json` 的内容并发送（单行 JSON）。

### 验证回传

wscat 终端应在 5~15s 内收到 relay 推送的 `task_event` 消息，
内容结构参见 `expected-task-event.json`。

## 失败情形

| 现象 | 可能原因 |
|---|---|
| relay connected 未出现 | CODEFLOW_RELAY_URL 未设或 relay 服务未启动 |
| wscat 发送后 inbox 无文件 | relay-bridge.ts 未实现 task_create 处理 |
| 无 task_event 回传 | relay-bridge.ts 未订阅 runtime 事件 |
| wscat 连接即断开 | room_key 错误或 relay 版本不兼容 |
