# CDP Multi-Agent Differentiation Mechanism

> Applicable modules: `cursor_cdp.py`, `nudger.py`, `web_panel.py`  
> Prerequisite: Cursor launched with `--remote-debugging-port=5253`

---

## 1. Why CDP

| Dimension | OCR Mode | CDP Mode |
|-----------|----------|----------|
| Mechanism | Screenshot → image recognition → guess | Direct DOM read → exact data |
| Accuracy | ~90% (affected by font size, DPI, theme) | 100% (reads DOM attributes directly) |
| Latency | 300–800ms | 10–15ms |
| Coordinate retrieval | OCR text bounding box (offset risk) | `getBoundingClientRect()` real-time |
| Active state detection | Color/font/brightness heuristics | `aria-selected="true"` exact match |
| Busy detection | OCR guessing spinner characters | Direct Stop button visibility check |
| Click method | `pyautogui.click(x, y)` screen coords | CDP `Input.dispatchMouseEvent` window coords |

**Design principle**: CDP is primary, OCR is purely a fallback channel. When CDP is available, OCR is never touched.

---

## 2. CDP-First Architecture Overview

All features follow "CDP first, OCR fallback":

| Feature | What CDP Does | When OCR Is Used |
|---------|--------------|-----------------|
| **Switch + Send** | `click_role` + `type_and_send` + `press_enter` | Only on CDP failure |
| **Busy detection** | Check Stop button visibility | Only when CDP doesn't detect |
| **Switch test** | `is_cdp_available()` → pure CDP switch verification | CDP port unreachable |
| **Approval detection** | `pending_approvals` count | Only when CDP doesn't detect |
| **First hello** | `_switch_and_send_with_cdp` | Only on CDP failure |
| **Status scan** | `cdp_scan()` | Only when CDP fails → `vision_scan()` |
| **Wait for idle** | `cdp_scan().is_busy` polling | Only when CDP doesn't detect |

The two **never run simultaneously in the same operation** — it's an if/else relationship, not mixed calls.

```
Execution flow for any operation:

    CDP available?
    ├─ Yes → Execute via CDP
    │       ├─ Success → Done, OCR never touched
    │       └─ Failure → Degrade to OCR
    └─ No → Execute via OCR
```

---

## 3. Core Selectors for Multi-Agent Differentiation

Cursor's Agent sessions appear as Tabs, each Agent corresponding to one Tab. CDP distinguishes them precisely through two DOM selector layers:

### 3.1 Layer 1: Top Tab Bar `div[role="tab"]`

```
Cursor window top
┌──────────────────────────────────────────────────┐
│  [1-PM]  [2-DEV]  [3-QA]  [4-OPS]               │
│   ↑ div[role="tab"]                              │
│   Attribute: aria-selected="true" / "false"      │
│   Content: textContent = "1 PM" / "2-DEV" / ...  │
└──────────────────────────────────────────────────┘
```

- **Selector**: `document.querySelectorAll('div[role="tab"]')`
- **Role name extraction**: regex `/^\s*(\d{1,2})[\s\-\.]+([A-Za-z][A-Za-z0-9\-]+)\s*$/` against `textContent`
- **Normalization**: `parseInt(number).padStart(2,'0') + '-' + roleName.toUpperCase()` → e.g. `01-PM`, `02-DEV`
- **Active state detection**: `tab.getAttribute('aria-selected') === 'true'` or `tab.classList.contains('active')`
- **Deduplication**: `Set` prevents duplicate Tab names from being counted

### 3.2 Layer 2: Right-Side Agent Sidebar `span.agent-sidebar-cell-text`

```
Cursor right sidebar (Agents list)
┌─────────────────┐
│  1-PM            │
│  2-DEV           │ ← span.agent-sidebar-cell-text
│  3-QA            │
│  4-OPS           │
└─────────────────┘
```

- **Selector**: `document.querySelectorAll('span.agent-sidebar-cell-text')`
- **Role name extraction**: same regex as above
- **Purpose**: supplements roles not shown in Tab bar (Tab count has an upper limit; overflow roles only appear in sidebar)
- **Note**: sidebar roles have no `aria-selected`, not used for active state detection

### 3.3 Two-Layer Relationship

```
scan() execution flow:

1. Iterate div[role="tab"]
   → Extract role names + check aria-selected
   → Populate allRoles[] + chatTabs[] + agentRole (active)

2. Iterate span.agent-sidebar-cell-text
   → Only append roles not already found in Tab bar (dedup)
   → sidebarVisible = true

3. Return:
   - allRoles = ["01-PM", "02-DEV", "03-QA", "04-OPS"]
   - agentRole = "02-DEV"       ← currently active
   - chatTabs = [{role, active}, ...]
```

---

## 4. Role Switching: Real-Time Coordinates + Native Mouse Events

> **Role naming convention**: CodeFlow supports four team templates (dev-team / media-team / mvp-team / qa-team).
> See [`docs/agents/README.md`](../agents/README.md#角色命名规范) for the complete role roster, Cursor Tab display names, file protocol names, and normalization rules.
> CDP does not distinguish between teams — it uniformly matches Tabs using the `number-ROLE_NAME` format.

### 4.1 Why Not Fixed Coordinates

Tab positions change with:
- Window size and position
- Sidebar expanded / collapsed
- Number and order of Tabs
- Monitor DPI and scaling

Therefore **coordinates are queried in real-time before every switch**, never cached.

### 4.2 Positioning Flow (`_js_find_role_position`)

```javascript
// 1. Build match function: target "02-DEV" → matches "2 DEV", "02-DEV", "2.DEV"
const target = "02-DEV";
const shortName = "DEV";  // strip number prefix

// 2. Search Tab bar first
for (const tab of document.querySelectorAll('div[role="tab"]')) {
    if (match(tab.textContent)) {
        const rect = tab.getBoundingClientRect();  // ← real-time coords
        return { found: true, x: rect.centerX, y: rect.centerY, source: 'tab' };
    }
}

// 3. Tab bar not found → search sidebar
for (const cell of document.querySelectorAll('span.agent-sidebar-cell-text')) {
    if (match(cell.textContent)) {
        const rect = cell.getBoundingClientRect();  // ← real-time coords
        return { found: true, x: rect.centerX, y: rect.centerY, source: 'sidebar' };
    }
}
```

### 4.3 Click Method (`click_role`)

```
el.click()  ← Unreliable in React/Electron, events may be swallowed

CDP Input.dispatchMouseEvent ← Simulates real mouse press+release, reliable
  → mousePressed  (x, y, button="left", clickCount=1)
  → mouseReleased (x, y, button="left", clickCount=1)
```

Why `Input.dispatchMouseEvent` instead of `el.click()`:
- Cursor is based on Electron + React; synthetic click events don't necessarily trigger React's event handlers
- `dispatchMouseEvent` goes through the browser's native input pipeline, behaving identically to a real mouse

### 4.4 Switch Verification

After clicking, `scan()` is executed at 0.5s to verify that `agentRole` matches the target:

```python
state = cdp_scan()
cdp_role = re.sub(r'^\d+[-_\s]*', '', state.agent_role).upper()
if cdp_role != resolved:
    return False  # switch failed, degrade to OCR
```

---

## 5. Message Sending

After switch confirmation, CDP sends messages as follows:

```
1. type_and_send(msg)
   → JS finds textarea/contenteditable input
   → Sets value via nativeInputValueSetter (bypasses React controlled components)
   → Triggers input event

2. If type_and_send fails → insert_text(msg)
   → CDP Input.insertText direct insertion (most reliable)

3. press_enter()
   → CDP Input.dispatchKeyEvent (keyDown + keyUp, key="Enter")
   → Fallback: JS KeyboardEvent simulation
```

---

## 6. Real-Time Probing vs Global Cache

| Scenario | Mechanism |
|----------|-----------|
| Patrol main loop | `nudger._cdp_active` global variable, probed at startup, retried every 30 cycles |
| Switch test | `is_cdp_available()` real-time CDP port probe, independent of global state |
| Panel status display | `/api/status` reads nudger cache first; if cache is False, supplements with real-time probe |
| DOM inspection | `/api/cdp-probe` always connects in real-time |

---

## 7. Agent Busy Detection Mechanism

The patrol engine checks whether an Agent is working before sending messages. **If busy, it defers the nudge, puts the task back in queue, and retries on the next patrol cycle.**

**CDP first, OCR fallback** — consistent with all other features.

### 7.1 CDP Busy Detection (3 Layers, Precision Narrowing)

**Layer 1: Stop Button Detection (most reliable — corresponds to the visual "spinning")**

Cursor shows a Stop/Cancel button while an Agent is running. This is the most reliable busy signal — it only appears when actually working:

| Selector | Description |
|----------|-------------|
| `button[aria-label="Cancel"]` | Cancel button |
| `button[aria-label="Stop"]` | Stop button |
| `button[class*="stop"]` | Stop-class button |
| `button[class*="cancel-generation"]` | Cancel generation button |

Only when the button is **visible** (`offsetParent !== null`) → `busy_hint = "stop_button_visible"`

**Layer 2: Spinner Animation in Composer Area**

Searches only within the Composer/chat panel area for `[class*="animate-spin"]` or `[class*="spinner"]`,
excluding global loading elements (such as code highlighting, lazy load, and other unrelated elements).

**Layer 3: Status Text Matching**

Searches for keywords in **short text** elements (≤80 chars) whose class contains `agent-status`, `thinking`, `generating`:

| Keyword | Meaning |
|---------|---------|
| `generating` | Agent is generating a reply |
| `thinking` | Agent is thinking |
| `planning` | Agent is planning |
| `running terminal` | Agent is executing a terminal command |
| `running command` | Agent is running a command |
| `applying patch` | Agent is applying a patch |
| `searching` | Agent is searching |

Match any → `is_busy = true`, `busy_hint = "status:<text>"`

### 7.2 OCR Busy Detection (only used when CDP is unavailable)

**Layer 1: Sidebar Role Row Prefix Icon**

OCR scans each role row in the sidebar, checking the **first character**:

| Character | Verdict | Description |
|-----------|---------|-------------|
| ✓ ✔ ☑ ○ | Idle | Complete/waiting marks |
| 📌 📍 🖈 | Idle | Pin = currently selected but idle |
| ⌖ ✯ ❖ | Idle | Other idle marks |
| Common symbols (@#$&*:; etc.) | No verdict | Common OCR misrecognition chars, whitelisted |
| Other rare special symbols | **Busy** | OCR recognition artifacts of spinner animation |
| Letters / Numbers | No verdict | Skipped |

The whitelist excludes `@ # $ & * : ; / \ ' " ( ) [ ] { } ! ? , < > ~ ^ | + =` and other common OCR misrecognition characters.

**Layer 2: Short Line Status Text**

Scans on-screen lines under 72 characters, matching keywords (same as CDP Layer 3):
`generating`, `thinking`, `planning next`, `running terminal`, `running command`, `applying patch`

### 7.3 Complete Busy Detection Flow

```
Preparing to nudge TASK-xxx-to-QA.md → target = QA
    │
    ├─ CDP available?
    │    ├─ Yes → CDP switches to QA → cdp_scan() checks is_busy
    │    │       ├─ QA is busy → defer nudge
    │    │       └─ QA is idle → proceed to send
    │    └─ No ↓
    │
    └─ OCR fallback → vision_scan()
         ├─ Busy detected → busy role == QA?
         │       ├─ Yes → defer nudge
         │       └─ No → no impact (another Agent being busy doesn't block nudging QA)
         └─ No busy detected → proceed to send
```

### 7.4 Wait-for-Idle Polling (`_wait_while_agent_busy`)

The last line of defense before sending a message. After switching to the target, polls until idle:

```
CDP first → cdp_scan().is_busy polling
OCR fallback → vision_scan().is_busy polling
    → Scan every 4s, max 48 rounds ≈ 192s
    → Send immediately once idle
    → Timeout still sends (prevents permanent blocking)
```

### 7.5 Approval Detection (`detect_and_kick_idle`)

Detects whether an Agent is waiting for user approval (e.g., tool call confirmation), auto-sends "continue":

```
CDP first → cdp_scan().agent_status == "waiting_approval"
           or pending_approvals count > 0
OCR fallback → scan chat area lower half for text matching "approve" keywords
```

### 7.6 Status Derivation

CDP derives `agent_status` from busy state for panel display:

| Condition | agent_status |
|-----------|-------------|
| `pending_approvals > 0` | `waiting_approval` |
| `is_busy = true` | `running` |
| Has role but not busy | `idle` |

---

## 8. CDP Failure Scenarios and Mitigations

All failure scenarios **automatically degrade to OCR** — no stuck states or lost messages.

### 8.1 Startup Layer

| Scenario | Cause | Mitigation | Behavior |
|----------|-------|------------|----------|
| Cursor launched without CDP port | User double-clicked icon without `--remote-debugging-port=5253` | `cursor_embed.py` detects and auto-kills + relaunches Cursor | 5–10s first-launch delay |
| Port 5253 occupied | Another Chrome/Electron app claimed 5253 | Connects to wrong app → can't find roles → degrades to OCR | Log shows "CDP target not found" |
| Firewall/security software blocks | `localhost:5253` HTTP/WebSocket blocked | Connection timeout → degrades to OCR | Log shows "CDP targets fetch failed" |

### 8.2 Runtime Layer

| Scenario | Cause | Mitigation | Behavior |
|----------|-------|------------|----------|
| CDP connection dropped | Cursor crash, restart, window close | Connection cache checks `is_connected`, auto-reconnects on next call | Brief 1–2 cycle OCR degradation, then auto-recovers |
| React render delay | Virtual DOM not yet updated after Tab switch | `sleep(0.5s)` after switch before verification | Very slow machines may fail verification → degrade to OCR retry |
| Multi-window ambiguity | Multiple Cursor windows open | Prioritizes first target with "Cursor" in title | May pick wrong window → role verification mismatch → degrades to OCR |

### 8.3 Long-Term Maintenance Layer (highest risk)

| Scenario | Cause | Mitigation | Behavior |
|----------|-------|------------|----------|
| Cursor upgrade changes DOM structure | `div[role="tab"]`, `aria-selected`, `span.agent-sidebar-cell-text` renamed/removed | `/api/cdp-probe` inspects new DOM structure, manually update selectors | Scans 0 roles → degrades to OCR |
| Cursor upgrade changes event handling | `Input.dispatchMouseEvent` no longer triggers Tab switch | Degrades to OCR's `pyautogui.click()` | CDP click ineffective → verification fails → degrades to OCR |
| Role name format change | Cursor no longer displays Tab titles as `number-ROLE_NAME` | Regex match fails → degrades to OCR | `allRoles` is empty |

### 8.4 Degradation Safety Chain

```
Any CDP step fails
    │
    ├─ Port unreachable     → entire cycle uses OCR (no CDP attempts)
    ├─ Connection dropped   → this cycle uses OCR, auto-reconnect next cycle
    ├─ Role positioning fails → this role uses OCR
    ├─ Click verify mismatch → this role retries with OCR
    └─ Message send fails   → send step uses OCR

OCR also fails?
    → Enters retry queue, next patrol cycle retries
    → Panel shows failure status, human can intervene manually
```

---

## 9. Debugging Tools

### 9.1 CDP DOM Inspection

```
GET http://127.0.0.1:18765/api/cdp-probe
```

Returns all Agent-related elements in Cursor's current DOM, including:
- `tabs[]`: all `[role="tab"]` elements with text, class, coordinates, `aria-selected`
- `roleTexts[]`: all leaf nodes matching role name patterns with 6-level ancestor chains

Purpose: when selectors break (Cursor upgrade changes DOM), use this endpoint to inspect the new DOM structure and update selectors.

### 9.2 Switch Test

Panel "Switch Test" button → `/api/agent/test_all`

Switches to each Agent sequentially and verifies. Logs show:
- `CDP locating Agent…` → using CDP channel
- `OCR recognizing sidebar Agent position…` → using OCR channel (CDP unavailable)

### 9.3 Standalone Test

```bash
python cursor_cdp.py
```

Outputs CDP scan results, role list, active state, and speed comparison with OCR.

---

## 10. Maintenance Steps After Cursor Upgrade

When a Cursor upgrade breaks CDP differentiation:

1. Visit `/api/cdp-probe` to get the new DOM structure
2. Check whether `role`, `cls`, `ariaSelected` in `tabs[]` still exist
3. Check whether `tag`, `cls`, `ancestors` in `roleTexts[]` have changed
4. Update selectors in `cursor_cdp.py`:
   - `_JS_EXTRACT_STATE`: role scanning selectors
   - `_js_find_role_position()`: role positioning selectors
5. Repackage and test

---

## Appendix: Source File Index

| File | Responsibility |
|------|---------------|
| `cursor_cdp.py` | CDP low-level communication, DOM extraction JS, high-level API (scan/click_role/type_and_send/press_enter) |
| `nudger.py` | Patrol main loop, CDP/OCR switching dispatch, busy detection, first hello, nudge sending |
| `cursor_vision.py` | OCR scanning, sidebar recognition, busy detection (fallback channel) |
| `web_panel.py` | Panel API, switch test, CDP DOM inspection endpoint |
| `cursor_embed.py` | Cursor launch management, CDP port detection and auto-restart |
