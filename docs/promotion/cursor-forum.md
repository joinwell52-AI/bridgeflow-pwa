# Cursor Forum — Updated Post

**Category:** Showcase / Built for Cursor
**Title:** CodeFlow: phone-first PWA for multi-agent Cursor teams — send tasks, not just approve them

**Update to existing thread:** https://forum.cursor.com/t/cursor-ai-automated-team-4-role-autonomous-ai-dev-team-with-mdc-rules-patrol-bot-87-person-days-in-17-days/156224

---

**UPDATE: From methodology → shipped product, with a phone-first PWA**

I saw [CursorRemote's post](https://forum.cursor.com/t/cursor-on-your-phone-open-source-remote-control-for-agent-mode/155524) and loved the idea of controlling Cursor from your phone. We've been solving a related but different problem: **what if you could dispatch _tasks_ to a whole AI team from your phone, not just approve individual tool calls?**

## The problem we solve differently

Most "Cursor on phone" tools let you **react** (approve/reject). CodeFlow lets you **direct** — you're the boss sending orders to a 4-person AI team (PM + DEV + QA + OPS), and they execute autonomously while you go about your day.

## Why PWA matters

We chose PWA over a regular web page or native app for specific reasons:

- **Install to home screen** — looks and feels like a native app, one tap to open
- **Works offline** — cached via Service Worker, so you can review past reports on the subway
- **No app store gatekeeping** — scan a QR code, add to home screen, done in 5 seconds
- **Push-ready architecture** — the WebSocket relay keeps you connected in real-time
- **Cross-platform for free** — iOS Safari, Android Chrome, desktop browsers, all the same codebase
- **Tiny footprint** — no 100MB download, no updates to manage

This isn't just a monitoring dashboard. The PWA is your **command center**:
1. Type a task on your phone → it becomes a `TASK-*.md` file on your PC
2. PM-01 (AI project manager) breaks it down and dispatches to DEV/QA/OPS
3. Desktop EXE patrols all agent windows, OCR-detects stuck UI, auto-restarts
4. Reports flow back to your phone in real-time
5. You review from anywhere — the bus, a café, your bed

## Full architecture

```
Phone (PWA)  ←→  WebSocket Relay  ←→  Desktop EXE  ←→  Cursor IDE
   📱                 🌐                  🖥️              💻
 send tasks      event bridge        OCR patrol       4 AI agents
 view status     room-based          self-healing     PM/DEV/QA/OPS
 QR binding      < 8KB msgs          nudge idle       .mdc rules
```

## What's in the box

### Desktop App (v2.9.44)
- Windows EXE (~35MB), double-click to run
- **Self-healing patrol**: OCR detects stuck Cursor UI → auto window reload
- Auto-nudge for stuck/idle agents
- Real-time relay bridge to phone
- Built-in control panel with task pipeline, agent mapping, patrol trace

### Mobile PWA (v2.3.0)
- Send tasks to your AI team from your phone
- Real-time status, markdown viewer, role filtering
- QR code binding — scan and connect in 5 seconds
- Full bilingual support (EN/中文)
- Works offline, add to home screen

### MCP Plugin
- `init_project` — set up team with one command
- `send_task` — dispatch tasks from Cursor chat
- `list_tasks` / `get_team_status` — read reports without leaving the IDE

### 3 Team Templates (not just dev!)
- **dev-team**: PM / DEV / QA / OPS — software development
- **media-team**: WRITER / EDITOR / PUBLISHER / COLLECTOR — content pipeline
- **mvp-team**: MARKETER / RESEARCHER / DESIGNER / BUILDER — product launch

## How it compares

| | CursorRemote | CodeFlow |
|---|---|---|
| Phone role | Remote control (approve/reject) | **Command center (send tasks)** |
| Agent model | Single agent, multi-window | **Multi-role team (4 agents)** |
| Self-healing | — | **OCR patrol + auto-restart** |
| Offline | — | **PWA with Service Worker** |
| Protocol | CDP DOM polling | **File-based (every msg = .md file)** |
| Price | $7.99 | **Free & open source (MIT)** |
| Team templates | — | **3 templates (dev/media/mvp)** |

Not a knock on CursorRemote — it's great for what it does (real-time approval flow). CodeFlow is for a different use case: you want to **manage a team of AI agents**, not babysit a single one.

## Links
- **Try PWA on phone (scan QR or open link)**: https://joinwell52-ai.github.io/codeflow-pwa/
- **Download Desktop EXE**: https://github.com/joinwell52-AI/codeflow-pwa/releases
- **Product page**: https://joinwell52-ai.github.io/codeflow-pwa/promotion/
- **GitHub**: https://github.com/joinwell52-AI/codeflow-pwa
- **Methodology (87 person-days in 17 days)**: https://joinwell52-ai.github.io/joinwell52/

MIT licensed. Battle-tested: 91 production deployments. Would love feedback — especially on what team templates you'd want next!
