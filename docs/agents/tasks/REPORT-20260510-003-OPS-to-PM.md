---
protocol: fcop
version: 1
kind: report
report_id: REPORT-20260510-003
sender: OPS
recipient: PM
priority: P1
thread_key: codeflow-v0.2-relay-health-check-and-deploy-prep
references:
  - TASK-20260510-003-PM-to-OPS
  - REPORT-20260510-002-PM-to-ADMIN
  - docs/design/spike-v2-deploy.md
layer: worker
---

# REPORT-20260510-003：公网 relay 健康验证 + v2 部署预案回执

## 一句话结论

公网 relay `wss://ai.chedian.cc/codeflow/ws/` 基础健康验证通过：443 连通、WebSocket ping/pong 正常、hello 后返回 `device_roster`，双 room 隔离验证正常。本地 `server/relay/server.py` 协议字段已含 `task_event` / `agent_status`。远端部署 commit/hash 因 SSH 凭据不可用未能只读确认；OPS 未修改公网 relay、未重启服务、未改 Nginx/防火墙。

SPIKE 文档已落：`docs/design/spike-v2-deploy.md`。

## Step 1：公网 relay 健康验证

### 1.1 443 连通性

命令：

```powershell
Test-NetConnection ai.chedian.cc -Port 443
```

输出：

```text
ComputerName     : ai.chedian.cc
RemoteAddress    : 120.55.164.16
RemotePort       : 443
SourceAddress    : 172.16.15.155
TcpTestSucceeded : True
```

结论：公网 443 可达。

### 1.2 WebSocket ping/pong

说明：`npx wscat -c ... -x '{json}'` 在 PowerShell 下发生 JSON 引号转义问题，服务端返回“消息不是合法 JSON”。为避免误判，OPS 改用 Node 24 原生 `WebSocket` 发送真实 JSON。

命令：

```powershell
node -e "const ws=new WebSocket('wss://ai.chedian.cc/codeflow/ws/'); const timer=setTimeout(()=>{console.error('TIMEOUT'); process.exit(2);},5000); ws.addEventListener('open',()=>{ws.send(JSON.stringify({room_key:'codeflow-ops-health-test',event_type:'ping',payload:{}}));}); ws.addEventListener('message',(ev)=>{console.log(ev.data); clearTimeout(timer); ws.close();}); ws.addEventListener('error',(e)=>{console.error('ERROR', e.message || e.type); process.exit(1);});"
```

输出：

```text
{"room_key": "codeflow-ops-health-test", "event_type": "pong", "payload": {}}
```

结论：ping/pong 正常。

### 1.3 hello / device_roster

命令：

```powershell
node -e "const ws=new WebSocket('wss://ai.chedian.cc/codeflow/ws/'); const timer=setTimeout(()=>{console.error('TIMEOUT'); process.exit(2);},5000); ws.addEventListener('open',()=>{ws.send(JSON.stringify({room_key:'codeflow-ops-health-test',event_type:'hello',sender:'OPS',client_type:'ops_health',payload:{device_id:'ops-test',device_name:'OPS Health Test',owner_role:'OPS'}}));}); ws.addEventListener('message',(ev)=>{console.log(ev.data); clearTimeout(timer); ws.close();}); ws.addEventListener('error',(e)=>{console.error('ERROR', e.message || e.type); process.exit(1);});"
```

输出：

```text
{"room_key": "codeflow-ops-health-test", "event_type": "device_roster", "payload": {"devices": [{"device_id": "ops-test", "device_name": "OPS Health Test", "owner_role": "OPS", "sender": "OPS", "client_type": "ops_health"}]}}
```

结论：hello 注册与 `device_roster` 返回正常。

### 1.4 room_key 隔离验证

命令：

```powershell
node -e "... open two WebSocket clients in codeflow-ops-health-test-a / codeflow-ops-health-test-b ..."
```

输出：

```text
{"room_key": "codeflow-ops-health-test-b", "event_type": "device_roster", "payload": {"devices": [{"device_id": "ops-test-2", "device_name": "OPS 2", "owner_role": "OPS", "sender": "OPS", "client_type": "ops_health"}]}}
{"room_key": "codeflow-ops-health-test-a", "event_type": "device_roster", "payload": {"devices": [{"device_id": "ops-test-1", "device_name": "OPS 1", "owner_role": "OPS", "sender": "OPS", "client_type": "ops_health"}]}}
```

结论：两个 room 的 roster 分别只包含各自 device，未观察到串房。

### 1.5 server.py 最近 5 次修改

命令：

```powershell
git log --oneline -- server/relay/server.py | Select-Object -First 5
```

输出：

```text
7d2e1c8 fix(relay): add switch_agent_focus/resume_patrol to ALLOWED_EVENTS and direct routing
04918b1 release: CodeFlow Desktop v2.11.0
41d66e1 release: PC v2.9.43 + PWA v2.2.9
071ccfd docs: add message-protocol.md for PC/PWA/AI interaction
b5b59f3 feat(desktop): v2.9.04 onboarding wizard, process detection, port fix
```

结论：本地 relay server 最近一次协议相关提交为 `7d2e1c8`。

## Step 2：公网 relay 部署版本核对

### 2.1 本地 server/relay/server.py 当前 commit

命令：

```powershell
git log -1 --format='%H %s' -- server/relay/server.py
```

输出：

```text
7d2e1c8531421e34ed56bb6b27b0b5d195ae2cff fix(relay): add switch_agent_focus/resume_patrol to ALLOWED_EVENTS and direct routing
```

### 2.2 本地 server.py SHA256

命令：

```powershell
Get-FileHash -Algorithm SHA256 "server/relay/server.py"
```

输出：

```text
Algorithm : SHA256
Hash      : B685897C0D0D65C6873174AE3E59D46E3BAC5921A42DA9DC470019FE36EF6DD2
Path      : D:\Bridgeflow\server\relay\server.py
```

### 2.3 ALLOWED_EVENTS 核对

命令：

```powershell
Select-String -Path "server/relay/server.py" -Pattern '"task_event"|"agent_status"'
```

输出：

```text
server\relay\server.py:20:    "task_event",
server\relay\server.py:32:    "agent_status",
```

结论：本地协议字段包含 `task_event` / `agent_status`。

### 2.4 远端部署 hash 核对结果

尝试命令：

```powershell
ssh -o BatchMode=yes -o ConnectTimeout=8 root@120.55.164.16 'echo relay-host-ok; systemctl is-active codeflow-relay; cd /opt/codeflow 2>/dev/null && git rev-parse HEAD 2>/dev/null || true; sha256sum /opt/codeflow/server.py 2>/dev/null; grep -n -e task_event -e agent_status /opt/codeflow/server.py 2>/dev/null'
```

输出：

```text
root@120.55.164.16: Permission denied (publickey,password).
```

结论：当前 OPS 会话无可用 SSH 凭据，无法读取公网服务器 `/opt/codeflow/server.py` 或 systemd 状态。OPS 未进行任何部署、重启或配置变更。建议 PM/ADMIN 后续提供只读 SSH 方式，或派授权 OPS 任务补做远端 hash 核对。

## Step 3：v0.2 / v1.0 部署预案 SPIKE

已输出：`docs/design/spike-v2-deploy.md`。

文档包含：

- 方案 A：v2 codeflow-shell 仅本地跑（OPS 推荐 v0.2 阶段采用）
- 方案 B：v2 codeflow-shell 用 codespace / 公网 VPS 跑（v1.0 后再考虑）
- 方案 C：v2 codeflow-shell 内嵌本地 relay（127.0.0.1:5252）
- 三方案对比矩阵：部署复杂度 / 安全性 / ADMIN 体验 / 运维高危操作

## 风险与建议

1. 公网 relay 从外部行为看健康，但远端部署版本未能核对；P3 relay-bridge 可先基于现有公网行为开发，远端 hash 待凭据补核。
2. v0.2 阶段建议采用本地 codeflow-shell 方案，不部署公网试用机。
3. 如后续要部署公网试用机，必须新建 OPS 任务并取得 ADMIN 二次确认，尤其涉及 systemd、Nginx、防火墙或服务重启。

OPS-01 `TASK-20260510-003` 完成。
