# Reddit r/cursor Post

**Subreddit:** r/cursor
**Title:** I built a PWA to command 4 AI agents in Cursor from my phone — not just approve, but dispatch tasks (open source)

---

Hey r/cursor!

You know the pain: you start a Cursor agent, walk away, come back and it's been stuck waiting for approval for 20 minutes. CursorRemote solved this for single-agent approve/reject. But I wanted something different — **what if my phone could dispatch tasks to a whole AI team?**

So I built **CodeFlow** — a phone-first PWA + Desktop EXE for managing multi-agent Cursor teams.

**Why PWA instead of a web page or native app?**

- Install to home screen — feels like a real app
- Works offline (Service Worker cache) — review reports on the subway
- No app store, no downloads — scan QR, add to home screen, 5 seconds
- Real-time via WebSocket relay
- Same codebase for iOS, Android, desktop

**The workflow:**

1. Open PWA on phone → type a task
2. Task arrives on your PC as a markdown file
3. PM-01 (AI project manager) breaks it down, dispatches to DEV/QA/OPS
4. Desktop EXE patrols all agent windows with OCR — if one freezes, auto-restart
5. Reports flow back to your phone in real-time
6. You review from anywhere

**What's included:**

- **Desktop EXE** (~35MB) — OCR self-healing patrol, auto-nudge stuck agents
- **Phone PWA** — command center, not just a dashboard
- **MCP Plugin** — init teams and dispatch from Cursor chat
- **3 team templates**: dev-team (PM/DEV/QA/OPS), media-team (WRITER/EDITOR/PUBLISHER/COLLECTOR), mvp-team (MARKETER/RESEARCHER/DESIGNER/BUILDER)

**The protocol:** "Filename as Protocol" — every task is a markdown file like `TASK-20260414-003-PM01-to-DEV01.md`. Zero databases, zero message queues. Everything is a traceable file.

Battle-tested: 87 person-days of AI output in 17 days, 91 production deploys, zero incidents.

- **Try PWA now (phone):** https://joinwell52-ai.github.io/codeflow-pwa/
- **Download Desktop EXE:** https://github.com/joinwell52-AI/codeflow-pwa/releases
- **Product page:** https://joinwell52-ai.github.io/codeflow-pwa/promotion/
- **GitHub:** https://github.com/joinwell52-AI/codeflow-pwa
- **Methodology:** https://joinwell52-ai.github.io/joinwell52/

MIT licensed, fully bilingual (EN/中文). Free forever. Would love feedback!
