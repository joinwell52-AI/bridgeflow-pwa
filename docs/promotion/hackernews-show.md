# Hacker News — Show HN

**Title:** Show HN: CodeFlow – See your AI agents' live chat from your phone, CDP-patrol in 10ms (open source)

**URL:** https://github.com/joinwell52-AI/codeflow-pwa

**Text (optional, for self-post):**

---

CodeFlow is an open-source tool for orchestrating multi-role AI teams in Cursor IDE.

Three core innovations:

**1. Agent Live Monitor (NEW v2.11)** — Phone PWA shows real-time summaries of what each AI agent is doing. CDP extracts the last 20 messages from Cursor's DOM, classifies them (text/code/terminal/file_edit/tool/thinking), streams to phone. Tap an agent card → instant read-only live panel.

**2. CDP Patrol Engine** — The desktop app uses Chrome DevTools Protocol to monitor Cursor agents. Reads DOM in 10ms (vs 300-800ms OCR), detects busy states via Stop button + aria attributes, switches agents with `Input.dispatchMouseEvent`. Auto-degrades to OCR if CDP fails. Zero stuck states.

| | OCR (before) | CDP (now) |
|---|---|---|
| Accuracy | ~90% | 100% |
| Latency | 300-800ms | 10-15ms |
| Detection | Screenshot guessing | DOM query exact match |

**3. Filename as Protocol** — Every task is a markdown file: `TASK-20260414-003-PM-to-DEV.md` — 7 routing fields in the filename. Zero databases, zero message queues.

The product: Desktop EXE (v2.11.0) patrols agents + Phone PWA (v2.4.2) sends tasks + monitors live + MCP Plugin for Cursor chat. 4 team templates (dev/media/mvp/qa). Full EN/ZH bilingual.

Born from a real production project: 87 person-days in 17 days, 91 deployments, zero incidents.

- Try the PWA: https://joinwell52-ai.github.io/codeflow-pwa/
- CDP Technical Doc: https://github.com/joinwell52-AI/codeflow-pwa/blob/main/docs/cdp-multi-agent.md
- Product page: https://joinwell52-ai.github.io/codeflow-pwa/promotion/

MIT licensed. Feedback on the Agent Live Monitor approach welcome.
