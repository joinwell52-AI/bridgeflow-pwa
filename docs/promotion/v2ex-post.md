# V2EX 帖子 — 分享创造

**节点:** /t/create 或 /t/share
**标题:** 码流 CodeFlow — 用手机指挥 AI 团队写代码（开源，附 EXE 下载）

---

各位好！分享一个我做的开源项目：**码流（CodeFlow）**。

### 一句话介绍

用手机给 AI 团队发指令，PC 端自动执行，文件协议协作，零数据库。

### 背景

之前在 Cursor IDE 里跑了一个 4 角色 AI 团队（PM + DEV + QA + OPS），17 天干了 87 人天的活，线上发版 91 次，零事故。于是把这套工作流做成了产品。

### 产品组成

- **桌面端 EXE**（~35MB）：巡检 Cursor Agent，自动催办卡住任务，Cursor 界面冻结时 OCR 检测 + 自动重载
- **手机端 PWA**：发任务、看状态、读报告、扫码绑定，离线可用
- **MCP 插件**：在 Cursor 对话里初始化团队、派任务、读报告
- **WebSocket 中继**：手机 ↔ PC 实时同步

### 核心创新：文件名即协议

```
TASK-20260414-003-PM01-to-DEV01.md
```

一个文件名包含 7 个字段：类型、日期、序号、发送方、接收方、方向、格式。
不需要数据库、不需要消息队列、不需要配置代码。

### 3 套团队模板

- `dev-team`：PM / DEV / QA / OPS（全栈开发）
- `media-team`：WRITER / EDITOR / PUBLISHER / COLLECTOR（内容媒体）
- `mvp-team`：MARKETER / RESEARCHER / DESIGNER / BUILDER（创业 MVP）

### 快速体验

1. 下载 EXE：https://github.com/joinwell52-AI/codeflow-pwa/releases
2. 国内镜像：https://gitee.com/joinwell52/cursor-ai/releases
3. 手机 PWA：https://joinwell52-ai.github.io/codeflow-pwa/
4. 产品主页：https://joinwell52-ai.github.io/codeflow-pwa/promotion/
5. GitHub：https://github.com/joinwell52-AI/codeflow-pwa

MIT 开源，中英双语。欢迎 Star 和反馈！

### 方法论

理论基础在这里：https://joinwell52-ai.github.io/joinwell52/
