# Reddit r/SideProject Post

**Subreddit:** r/SideProject
**Title:** I'm a solo dev running a full AI team from my phone — here's the open-source tool I built

---

I wanted to see if one person could manage a complete AI development team — not by chatting with one bot, but by orchestrating PM, DEV, QA, and OPS roles that collaborate autonomously.

After running this for 17 days on a real production project (87 person-days of output, 91 deployments, zero incidents), I turned it into an open-source product: **CodeFlow (码流)**.

**The setup:**
1. Download a 35MB Windows EXE
2. Double-click — it launches Cursor IDE + a control panel
3. Scan a QR code from your phone
4. Send tasks from the couch, review results over coffee

**What makes it different:**
- No databases, no APIs, no message queues — tasks are just markdown files with structured filenames
- Self-healing: if Cursor's UI freezes, the desktop app detects it via OCR and auto-reloads
- 3 team templates: dev-team, media-team, mvp-team — one command to set up
- Full bilingual support (English + Chinese)

**Stack:** Python (Desktop), vanilla HTML/JS (PWA), WebSocket relay, MCP protocol

- GitHub: https://github.com/joinwell52-AI/codeflow-pwa
- Try the PWA: https://joinwell52-ai.github.io/codeflow-pwa/
- Product page: https://joinwell52-ai.github.io/codeflow-pwa/promotion/

MIT license. Feedback welcome!
