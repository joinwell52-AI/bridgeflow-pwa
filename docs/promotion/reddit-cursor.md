# Reddit r/cursor Post

**Subreddit:** r/cursor
**Title:** CodeFlow v2.11.0: See your AI agents' live chat from your phone — CDP patrol + Agent Live Monitor (open source)

---

Hey r/cursor!

You know the pain: your Cursor agent gets stuck, and you don't notice for 20 minutes. And when you're away from the PC, you have no idea what your agents are even doing.

**v2.11.0** ships two things to fix this: **CDP Patrol Engine** + **Agent Live Monitor**.

**Agent Live Monitor (NEW):**
- Tap any agent card on your phone → live panel slides up
- CDP extracts last 20 messages from Cursor DOM, classifies: text / code / terminal / file_edit / tool / thinking
- Streams summaries to phone in real-time via WebSocket relay
- Read-only — doesn't interfere with agent workflow

**CDP Patrol Engine:**
- Reads `div[role="tab"]` + `aria-selected` — **10ms, 100% accurate**
- 3-layer busy detection: Stop button → Spinner → Status text
- Switches agents with `Input.dispatchMouseEvent` (native, not `pyautogui`)
- Auto-degrades to OCR — **zero stuck states**

**The workflow:**
1. Open PWA on phone → type a task
2. Task arrives on PC as `TASK-*.md` file
3. PM-01 decomposes, dispatches to DEV/QA/OPS
4. Desktop EXE CDP-patrols all agents — auto-nudges stuck tasks
5. **Tap agent card → see live chat summaries on your phone**
6. Reports flow back in real-time

**What's included:**
- **Desktop EXE** (v2.11.0, ~35MB) — CDP patrol + Agent Live Monitor + OCR fallback
- **Phone PWA** (v2.4.2) — command center + live agent monitor
- **MCP Plugin** — init teams and dispatch from Cursor chat
- **4 team templates**: dev-team, media-team, mvp-team, qa-team

**The protocol:** Every task is `TASK-20260414-003-PM-to-DEV.md`. Zero databases.

- **Try PWA now (phone):** https://joinwell52-ai.github.io/codeflow-pwa/
- **Download Desktop EXE:** https://github.com/joinwell52-AI/codeflow-pwa/releases
- **China mirror:** https://gitee.com/joinwell52/cursor-ai/releases
- **CDP Technical Doc:** https://github.com/joinwell52-AI/codeflow-pwa/blob/main/docs/cdp-multi-agent.md
- **Product page:** https://joinwell52-ai.github.io/codeflow-pwa/promotion/
- **GitHub:** https://github.com/joinwell52-AI/codeflow-pwa

MIT licensed. 91 production deployments, zero incidents. Star us if you find it useful!
