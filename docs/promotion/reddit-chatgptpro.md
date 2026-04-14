# Reddit r/ChatGPTPro Post

**Subreddit:** r/ChatGPTPro (or r/LocalLLaMA / r/artificial)
**Title:** Built an open-source system where 4 AI agents (PM/DEV/QA/OPS) collaborate autonomously — controlled from your phone

---

Instead of chatting with one AI, I set up 4 specialized roles in Cursor IDE:

- **PM-01**: breaks down tasks, dispatches to team, collects reports
- **DEV-01**: codes, self-tests, submits deliverables
- **QA-01**: tests everything, files bugs through PM
- **OPS-01**: deploys, health checks, rollback plans

They communicate via markdown files — no databases, no APIs. The filename IS the protocol:

```
TASK-20260414-003-PM01-to-DEV01.md
```

I built **CodeFlow** to make this practical:
- **Desktop app** patrols agents, auto-nudges stuck work, self-heals frozen UIs
- **Phone PWA** lets you send tasks and review results from anywhere
- **MCP Plugin** integrates directly into Cursor chat

Real results: 87 person-days of work in 17 days. 91 production deployments. Zero incidents.

Open source, MIT licensed: https://github.com/joinwell52-AI/codeflow-pwa

Try the PWA: https://joinwell52-ai.github.io/codeflow-pwa/
