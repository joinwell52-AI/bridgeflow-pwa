# Hacker News — Show HN

**Title:** Show HN: CodeFlow – Command AI dev teams from your phone (Desktop+PWA, open source)

**URL:** https://github.com/joinwell52-AI/codeflow-pwa

**Text (optional, for self-post):**

---

CodeFlow is an open-source tool for orchestrating multi-role AI teams in Cursor IDE.

The core idea: "Filename as Protocol." Every task is a markdown file — `TASK-20260414-003-PM01-to-DEV01.md` — with 7 routing fields embedded in the filename. Zero databases, zero message queues.

The product has three parts:

1. **Desktop app** (Windows EXE, ~35MB): Patrols Cursor agent windows, auto-nudges stuck tasks, detects UI freezes via OCR, and auto-reloads. Bridges phone commands to Cursor via WebSocket relay.

2. **Mobile PWA**: Send tasks to your AI team from your phone. View real-time status, read markdown reports, filter by team role. Bilingual (EN/中文).

3. **MCP Plugin**: Initialize team templates (dev/media/mvp), dispatch tasks, and read reports — all from within Cursor's chat interface.

Born from a real production project: 87 person-days of AI output in 17 days, 91 deployments, zero incidents.

Started as a methodology write-up (https://joinwell52-ai.github.io/joinwell52/), then became a product.

Try the PWA: https://joinwell52-ai.github.io/codeflow-pwa/

MIT licensed. Looking for feedback on the "filename as protocol" approach and the self-healing patrol system.
