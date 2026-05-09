---
protocol: fcop
version: 1
kind: design-spike
status: DRAFT-OPS-SPIKE
owner: OPS
thread_key: codeflow-v0.2-relay-health-check-and-deploy-prep
references:
  - TASK-20260510-003-PM-to-OPS
  - REPORT-20260510-002-PM-to-ADMIN
  - TASK-20260510-002-PM-to-DEV
---

# v0.2 / v1.0 部署预案 SPIKE

## 一句话结论

OPS 推荐 v0.2 阶段采用 **方案 A：v2 codeflow-shell 仅在 ADMIN/执行机本地运行**。当前公网 relay `wss://ai.chedian.cc/codeflow/ws/` 已通过基础健康验证，可作为 P3 relay-bridge 的联调中继；但在 DEV-002 完成 relay-bridge 前，不建议部署 v2 codeflow-shell 到公网。

## 当前 relay 健康状态

| 项 | 结果 |
|---|---|
| `ai.chedian.cc:443` | 通过，`TcpTestSucceeded: True` |
| WebSocket ping/pong | 通过，收到 `event_type=pong` |
| WebSocket hello/device_roster | 通过，收到 `device_roster` |
| 本地 `server/relay/server.py` 最近 commit | `7d2e1c8531421e34ed56bb6b27b0b5d195ae2cff` |
| 本地 `ALLOWED_EVENTS` | 已含 `task_event` / `agent_status` |
| 远端部署 commit/hash | SSH 凭据不可用，未能只读确认；OPS 未做任何公网变更 |

## 方案 A：v2 codeflow-shell 仅本地跑（推荐 v0.2）

### 形态

ADMIN 或专用执行机在本地运行：

```powershell
cd D:\Bridgeflow\codeflow-shell
npm install
npm start
```

v0.2 后 codeflow-shell 内部增加 relay-bridge 客户端，主动连接公网 relay，监听 `task_event` / `agent_status` 等事件。

### 优点

- 部署最简单，不需要服务器权限、systemd、Nginx 或防火墙变更。
- 安全边界清晰：Cursor SDK、工作区文件、真实任务执行都留在本机。
- 与 v0.1 internal RC 的 `npm start` 试用路径连续，ADMIN 体验变化最小。
- relay 只做轻量消息转发，不承载代码执行。

### 风险

- 本机必须在线，断网/睡眠会中断 relay-bridge。
- 手机端无法直接唤醒本地进程，仍依赖用户启动 codeflow-shell。
- 多设备协作时需要更明确的 `room_key` / `device_id` 约定。

### 适用阶段

v0.2.0-alpha / beta / rc.1 内测阶段。

## 方案 B：v2 codeflow-shell 部署到 codespace / 公网 VPS

### 形态

将 codeflow-shell 运行在公网 VPS、Codespace 或云主机上，PWA 通过公网 relay 下达任务，云端 shell 执行 Runtime / Cursor SDK 相关逻辑。

### 优点

- 手机端体验接近“云端常驻”，ADMIN 不需要保持本机进程在线。
- 更适合后续多人/多角色常驻演示环境。
- 可用 systemd/supervisor 做守护。

### 风险

- 安全风险最高：工作区、凭据、Cursor SDK token、任务文件都进入公网主机。
- 需要 SSH、systemd、Nginx、日志、备份、密钥轮换等完整运维流程。
- 与“本地 Cursor 执行机”产品定位偏离，容易过早引入云执行复杂度。
- 公网部署属于高危范畴，任何服务重启、Nginx 修改、防火墙变更都需 ADMIN 二次确认。

### 适用阶段

v1.0 之后，如 ADMIN 明确需要公网试用机或团队共享演示环境，再单独派 OPS 部署任务。

## 方案 C：v2 codeflow-shell 内嵌本地 relay（127.0.0.1:5252）

### 形态

本机运行 codeflow-shell，同时启动一个本地 relay 或本地 bridge 服务：

```text
PWA / mobile
  -> public relay
  -> codeflow-shell relay-bridge client
  -> local relay 127.0.0.1:5252
  -> Runtime / inbox / agents
```

### 优点

- 仍保持代码执行在本机。
- 本地 relay 可为 Desktop、CLI、Cursor session 提供统一事件入口。
- 后续可逐步替代文件轮询 doorbell。

### 风险

- 架构复杂度中等，需要处理双 relay、断线重连、事件去重、端口占用。
- 本地端口与安全策略要明确，只允许 `127.0.0.1`，避免局域网暴露。
- 需要 QA 增加跨 relay 的 E2E fixture。

### 适用阶段

v1.0 前后，当 P3 relay-bridge 跑通且本地事件总线需求明确后再引入。

## 三方案对比矩阵

| 维度 | 方案 A：本地 codeflow-shell | 方案 B：公网 VPS / Codespace | 方案 C：内嵌本地 relay |
|---|---|---|---|
| 部署复杂度 | 低 | 高 | 中 |
| 安全性 | 高，执行与凭据留本机 | 低到中，需完整云安全治理 | 高，若仅绑定 127.0.0.1 |
| ADMIN 体验 | 需要本机启动进程 | 最顺滑，云端常驻 | 本机启动后体验较好 |
| 与 v0.1 连续性 | 最强 | 较弱 | 中 |
| 对公网 relay 依赖 | 仅消息中转 | 消息中转 + 云执行入口 | 消息中转 + 本地桥接 |
| 运维高危操作 | 无 | 多：systemd/Nginx/防火墙/重启 | 少：本地端口与进程管理 |
| 推荐阶段 | v0.2 | v1.0 后 | v1.0 前后 |

## OPS 推荐

1. v0.2 阶段采用方案 A，先把真 SDK、EXE/fallback、relay-bridge 的最小闭环跑通。
2. P3 relay-bridge 开发时只依赖公网 relay 的现有协议，不修改公网 relay。
3. 等 v0.2.0-rc.1 内测后，再根据 ADMIN 试用反馈决定是否进入方案 C。
4. 方案 B 暂不进入实施，除非 ADMIN 明确要求公网常驻试用机。

## 后续验证建议

- DEV-002 P3 完成后，QA 增加 `task_event` 从 PWA/wscat 到 codeflow-shell inbox 的 E2E。
- OPS 后续若获得 SSH 凭据，应补做远端 `/opt/codeflow/server.py` hash 与 systemd unit 只读核对。
- 若需要部署公网试用机，必须新建 `TASK-*-PM-to-OPS.md` 并在任务中记录 ADMIN 二次确认。
