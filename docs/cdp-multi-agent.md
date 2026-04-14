# CDP 多 Agent 区分机制

> 适用模块：`cursor_cdp.py`、`nudger.py`、`web_panel.py`  
> 前置条件：Cursor 以 `--remote-debugging-port=9222` 启动

---

## 一、为什么需要 CDP

| 维度 | OCR 模式 | CDP 模式 |
|------|----------|----------|
| 原理 | 截屏 → 图像识别 → 猜测 | 直接读 DOM → 精确数据 |
| 精度 | ~90%（受字号、DPI、主题影响） | 100%（直接读 DOM 属性） |
| 延迟 | 300–800ms | 10–15ms |
| 坐标获取 | OCR 返回的文字矩形框（有偏移风险） | `getBoundingClientRect()` 实时计算 |
| 激活态判定 | 靠颜色/字体/亮度推测 | `aria-selected="true"` 精确判定 |
| 忙碌检测 | OCR 猜字符是否是 spinner | 直接看 Stop 按钮是否可见 |
| 点击方式 | `pyautogui.click(x, y)` 屏幕坐标 | CDP `Input.dispatchMouseEvent` 窗口坐标 |

**设计原则**：CDP 做主力，OCR 纯粹作为降级通道。CDP 可用时不碰 OCR。

---

## 二、CDP 优先架构总览

所有功能都遵循"CDP 优先，OCR 降级"：

| 功能 | CDP 做什么 | OCR 什么时候用 |
|------|-----------|---------------|
| **切换 + 发送** | `click_role` + `type_and_send` + `press_enter` | CDP 失败才降级 |
| **忙碌检测** | 检测 Stop 按钮是否可见 | CDP 没检到才兜底 |
| **切换实测** | `is_cdp_available()` → 纯 CDP 切换验证 | CDP 端口不通 |
| **等待确认检测** | `pending_approvals` 计数 | CDP 没检到才 OCR 扫文字 |
| **打招呼** | `_switch_and_send_with_cdp` | CDP 失败才降级 |
| **状态扫描** | `cdp_scan()` | CDP 失败才 `vision_scan()` |
| **等待空闲** | `cdp_scan().is_busy` 轮询 | CDP 没检到才 OCR 兜底 |

两者**不会同时运行在同一个操作中**——是 if/else 关系，不是混合调用。

```
任何操作的执行流程：

    CDP 可用？
    ├─ 是 → 用 CDP 执行
    │       ├─ 成功 → 完成，不碰 OCR
    │       └─ 失败 → 降级到 OCR
    └─ 否 → 用 OCR 执行
```

---

## 三、多 Agent 区分的核心选择器

Cursor 的 Agent 会话以 Tab 形式展现，每个 Agent 对应一个 Tab。CDP 通过两层 DOM 选择器精确区分：

### 3.1 第一层：顶部 Tab 栏 `div[role="tab"]`

```
Cursor 窗口顶部
┌──────────────────────────────────────────────────┐
│  [1-PM]  [2-DEV]  [3-QA]  [4-OPS]               │
│   ↑ div[role="tab"]                              │
│   属性：aria-selected="true" / "false"           │
│   内容：textContent = "1 PM" / "2-DEV" / ...    │
└──────────────────────────────────────────────────┘
```

- **选择器**：`document.querySelectorAll('div[role="tab"]')`
- **角色名提取**：正则 `/^\s*(\d{1,2})[\s\-\.]+([A-Za-z][A-Za-z0-9\-]+)\s*$/` 匹配 `textContent`
- **归一化**：`parseInt(序号).padStart(2,'0') + '-' + 角色名.toUpperCase()` → 如 `01-PM`、`02-DEV`
- **激活态判定**：`tab.getAttribute('aria-selected') === 'true'` 或 `tab.classList.contains('active')`
- **去重**：`Set` 防止同名 Tab 重复计入

### 3.2 第二层：右侧 Agent 侧栏 `span.agent-sidebar-cell-text`

```
Cursor 右侧侧栏（Agents 列表）
┌─────────────────┐
│  1-PM            │
│  2-DEV           │ ← span.agent-sidebar-cell-text
│  3-QA            │
│  4-OPS           │
└─────────────────┘
```

- **选择器**：`document.querySelectorAll('span.agent-sidebar-cell-text')`
- **角色名提取**：同上正则
- **作用**：补充 Tab 栏未展示的角色（Tab 数量有上限，溢出的只在侧栏可见）
- **注意**：侧栏角色没有 `aria-selected`，不用于判断激活态

### 3.3 两层关系

```
scan() 执行流程：

1. 遍历 div[role="tab"]
   → 提取角色名 + 判断 aria-selected
   → 填充 allRoles[] + chatTabs[] + agentRole（激活态）

2. 遍历 span.agent-sidebar-cell-text
   → 仅追加 Tab 栏中没出现的角色（去重）
   → sidebarVisible = true

3. 返回：
   - allRoles = ["01-PM", "02-DEV", "03-QA", "04-OPS"]
   - agentRole = "02-DEV"       ← 当前激活的
   - chatTabs = [{role, active}, ...]
```

---

## 四、角色切换：实时坐标 + 原生鼠标事件

> **角色命名规范**：CodeFlow 支持四套团队模板（dev-team / media-team / mvp-team / qa-team），
> 每套角色的完整清单、Cursor Tab 显示名、文件协议名、归一化规则见 [`docs/agents/README.md`](../agents/README.md#角色命名规范)。
> CDP 层面不区分团队，统一用 `序号-角色名` 格式匹配 Tab。

### 4.1 为什么不用固定坐标

Tab 位置随以下因素变化：
- 窗口大小和位置
- 侧栏展开 / 折叠
- Tab 数量和顺序
- 显示器 DPI 和缩放

因此 **每次切换前都实时查询坐标**，不缓存。

### 4.2 定位流程 (`_js_find_role_position`)

```javascript
// 1. 构造匹配函数：目标 "02-DEV" → 同时匹配 "2 DEV"、"02-DEV"、"2.DEV"
const target = "02-DEV";
const shortName = "DEV";  // 去掉序号前缀

// 2. 优先搜索 Tab 栏
for (const tab of document.querySelectorAll('div[role="tab"]')) {
    if (match(tab.textContent)) {
        const rect = tab.getBoundingClientRect();  // ← 实时坐标
        return { found: true, x: rect中心x, y: rect中心y, source: 'tab' };
    }
}

// 3. Tab 栏没找到 → 搜索侧栏
for (const cell of document.querySelectorAll('span.agent-sidebar-cell-text')) {
    if (match(cell.textContent)) {
        const rect = cell.getBoundingClientRect();  // ← 实时坐标
        return { found: true, x: rect中心x, y: rect中心y, source: 'sidebar' };
    }
}
```

### 4.3 点击方式 (`click_role`)

```
el.click()  ← React/Electron 中不可靠，事件可能被吞掉

CDP Input.dispatchMouseEvent ← 模拟真实鼠标按下+释放，可靠
  → mousePressed  (x, y, button="left", clickCount=1)
  → mouseReleased (x, y, button="left", clickCount=1)
```

选用 `Input.dispatchMouseEvent` 而非 `el.click()` 的原因：
- Cursor 基于 Electron + React，合成 click 事件不一定触发 React 的事件处理器
- `dispatchMouseEvent` 走的是浏览器原生输入管道，与真实鼠标行为一致

### 4.4 切换验证

点击后 0.5s 执行 `scan()`，检查 `agentRole` 是否匹配目标：

```python
state = cdp_scan()
cdp_role = re.sub(r'^\d+[-_\s]*', '', state.agent_role).upper()
if cdp_role != resolved:
    return False  # 切换失败，降级到 OCR
```

---

## 五、消息发送

切换确认后，CDP 发送消息的流程：

```
1. type_and_send(msg)
   → JS 找到 textarea/contenteditable 输入框
   → 通过 nativeInputValueSetter 设值（绕过 React 受控组件）
   → 触发 input 事件

2. 如果 type_and_send 失败 → insert_text(msg)
   → CDP Input.insertText 直接插入（最可靠）

3. press_enter()
   → CDP Input.dispatchKeyEvent (keyDown + keyUp, key="Enter")
   → 降级：JS KeyboardEvent 模拟
```

---

## 六、实时探测 vs 全局缓存

| 场景 | 机制 |
|------|------|
| 巡检主循环 | `nudger._cdp_active` 全局变量，启动时探测，每 30 轮重试 |
| 切换实测 | `is_cdp_available()` 实时探测 CDP 端口，不依赖全局状态 |
| 面板状态显示 | `/api/status` 优先读 nudger 缓存，缓存为 False 时实时探测补充 |
| DOM 探查 | `/api/cdp-probe` 始终实时连接 |

---

## 七、Agent 忙碌检测机制

巡检器在发送消息前会检测 Agent 是否正在工作，**忙碌时不打断，暂缓催办，放回队列下一轮再试**。

**CDP 优先，OCR 降级**——与所有其他功能一致。

### 7.1 CDP 忙碌检测（三层，精确收窄）

**第一层：Stop 按钮检测（最可靠，对应视觉上的"转圈"）**

Cursor 在 Agent 运行时会显示 Stop/Cancel 按钮，这是最可靠的忙碌信号——只有真正在"转圈工作"才会出现：

| 匹配选择器 | 说明 |
|-----------|------|
| `button[aria-label="Cancel"]` | 取消按钮 |
| `button[aria-label="Stop"]` | 停止按钮 |
| `button[class*="stop"]` | 停止类按钮 |
| `button[class*="cancel-generation"]` | 取消生成按钮 |

仅当按钮**可见**（`offsetParent !== null`）时判定 → `busy_hint = "stop_button_visible"`

**第二层：Composer 区域内的旋转动画**

仅在 Composer/聊天面板区域内查找 `[class*="animate-spin"]` 或 `[class*="spinner"]`，
排除全局 loading 元素（如代码高亮、lazy load 等无关元素）。

**第三层：状态文字匹配**

在 class 含 `agent-status`、`thinking`、`generating` 的**短文本**元素（≤80 字）中搜索关键词：

| 关键词 | 含义 |
|--------|------|
| `generating` | Agent 正在生成回复 |
| `thinking` | Agent 正在思考 |
| `planning` | Agent 正在规划 |
| `running terminal` | Agent 正在执行终端命令 |
| `running command` | Agent 正在运行命令 |
| `applying patch` | Agent 正在应用补丁 |
| `searching` | Agent 正在搜索 |

命中任一 → `is_busy = true`，`busy_hint = "status:具体文本"`

### 7.2 OCR 忙碌检测（仅在 CDP 不可用时降级使用）

**第一层：侧栏角色行前缀图标**

OCR 扫描侧栏每个角色行，取 **第一个字符** 判断：

| 字符 | 判定 | 说明 |
|------|------|------|
| ✓ ✔ ☑ ○ | 空闲 | 完成/等待标记 |
| 📌 📍 🖈 | 空闲 | 图钉 = 当前选中但空闲 |
| ⌖ ✯ ❖ | 空闲 | 其他空闲标记 |
| 常见符号（@#$&*:; 等） | 不判定 | OCR 常见误识别字符，已加入白名单 |
| 其他罕见特殊符号 | **忙碌** | 转圈 spinner 的 OCR 识别产物 |
| 字母 / 数字 | 不判定 | 跳过 |

白名单排除了 `@ # $ & * : ; / \ ' " ( ) [ ] { } ! ? , < > ~ ^ | + =` 等常见 OCR 误识别字符。

**第二层：短行状态文案**

扫描屏幕上 72 字符以内的短行，匹配关键词（同 CDP 第三层）：
`generating`、`thinking`、`planning next`、`running terminal`、`running command`、`applying patch`

### 7.3 忙碌检测的完整流程

```
准备催办 TASK-xxx-to-QA.md → 目标 = QA
    │
    ├─ CDP 可用？
    │    ├─ 是 → CDP 先切到 QA → cdp_scan() 检测 is_busy
    │    │       ├─ QA 正忙 → 暂缓催办
    │    │       └─ QA 空闲 → 继续发送
    │    └─ 否 ↓
    │
    └─ OCR 兜底 → vision_scan()
         ├─ 检测到忙碌 → 忙碌角色 == QA？
         │       ├─ 是 → 暂缓催办
         │       └─ 否 → 不影响（别的 Agent 忙不阻塞催 QA）
         └─ 未检测到忙碌 → 继续发送
```

### 7.4 等待空闲轮询 (`_wait_while_agent_busy`)

发送消息前的最后一道防线，切换到目标后轮询等待空闲：

```
CDP 优先 → cdp_scan().is_busy 轮询
OCR 兜底 → vision_scan().is_busy 轮询
    → 每 4s 扫一次，最多 48 轮 ≈ 192s
    → 空闲后立即发送
    → 超时仍继续发送（避免永久阻塞）
```

### 7.5 等待确认检测 (`detect_and_kick_idle`)

检测 Agent 是否在等待用户确认（如审批工具调用），自动发"继续"：

```
CDP 优先 → cdp_scan().agent_status == "waiting_approval"
           或 pending_approvals 计数 > 0
OCR 兜底 → 扫描聊天区下半部分文字，匹配"approve"等关键词
```

### 7.6 状态推导

CDP 根据忙碌状态推导 `agent_status` 供面板展示：

| 条件 | agent_status |
|------|-------------|
| `pending_approvals > 0` | `waiting_approval` |
| `is_busy = true` | `running` |
| 有角色但不忙 | `idle` |

---

## 八、CDP 失效场景与应对

所有失效场景都会**自动降级到 OCR**，不会卡死或丢消息。

### 8.1 启动层

| 场景 | 原因 | 现有应对 | 表现 |
|------|------|----------|------|
| Cursor 未带 CDP 端口启动 | 用户直接双击图标，没有 `--remote-debugging-port=9222` | `cursor_embed.py` 检测到后自动 kill 并重启 Cursor | 首次启动延迟 5–10s |
| 端口 9222 被占用 | 其他 Chrome/Electron 应用抢占了 9222 | 连接到错误应用 → 扫描不到角色 → 降级 OCR | 日志出现 "未找到 CDP 目标" |
| 防火墙/安全软件拦截 | 拦截 `localhost:9222` 的 HTTP/WebSocket | 连接超时 → 降级 OCR | 日志出现 "CDP targets 获取失败" |

### 8.2 运行层

| 场景 | 原因 | 现有应对 | 表现 |
|------|------|----------|------|
| CDP 连接断开 | Cursor 崩溃、重启、窗口关闭 | 连接缓存检查 `is_connected`，下次调用自动重连 | 短暂 1–2 轮降级 OCR，之后自动恢复 |
| React 渲染延迟 | Tab 切换后虚拟 DOM 未更新完毕 | 切换后 `sleep(0.5s)` 再验证 | 极慢机器可能验证失败 → 降级 OCR 重试 |
| 多窗口歧义 | Cursor 开了多个窗口 | 优先选标题含 "Cursor" 的第一个 target | 可能选错窗口 → 角色验证不匹配 → 降级 OCR |

### 8.3 长期维护层（最大风险）

| 场景 | 原因 | 现有应对 | 表现 |
|------|------|----------|------|
| Cursor 升级改 DOM 结构 | `div[role="tab"]`、`aria-selected`、`span.agent-sidebar-cell-text` 被改名/移除 | `/api/cdp-probe` 探查新结构，手动更新选择器 | 扫描到 0 个角色 → 降级 OCR |
| Cursor 升级改事件处理 | `Input.dispatchMouseEvent` 不再触发 Tab 切换 | 降级到 OCR 的 `pyautogui.click()` | CDP 点击无效 → 验证失败 → 降级 OCR |
| 角色名格式变化 | Cursor 不再以 `数字-角色名` 格式显示 Tab 标题 | 正则匹配失败 → 降级 OCR | `allRoles` 为空 |

### 8.4 降级保障链

```
任何 CDP 环节失败
    │
    ├─ 端口不通         → 整体走 OCR（不尝试 CDP）
    ├─ 连接断开         → 该轮走 OCR，下轮自动重连
    ├─ 角色定位失败     → 该角色走 OCR
    ├─ 点击后验证不匹配 → 该角色走 OCR 重试
    └─ 消息发送失败     → 发送环节走 OCR
    
OCR 也失败？
    → 进入待重试队列，下轮巡检再试
    → 面板显示失败状态，人工可补一次点击
```

---

## 九、调试工具

### 9.1 CDP DOM 探查

```
GET http://127.0.0.1:18765/api/cdp-probe
```

返回 Cursor 当前 DOM 中与 Agent 相关的所有元素，包括：
- `tabs[]`：所有 `[role="tab"]` 元素的文本、class、坐标、`aria-selected`
- `roleTexts[]`：所有匹配角色名模式的叶子节点及其 6 级祖先链

用途：当选择器失效时（Cursor 升级改 DOM），用此接口获取新的 DOM 结构，更新选择器。

### 9.2 切换实测

面板「切换实测」按钮 → `/api/agent/test_all`

会逐个切换每个 Agent 并验证，日志显示：
- `CDP 定位 Agent…` → 走 CDP 通道
- `OCR 识别侧栏 Agent 位置…` → 走 OCR 通道（说明 CDP 不可用）

### 9.3 独立测试

```bash
python cursor_cdp.py
```

输出 CDP 扫描结果、角色列表、激活态、与 OCR 的速度对比。

---

## 十、Cursor 升级后的维护步骤

当 Cursor 升级导致 CDP 区分失效时：

1. 访问 `/api/cdp-probe`，获取新的 DOM 结构
2. 检查 `tabs[]` 中的 `role`、`cls`、`ariaSelected` 是否仍存在
3. 检查 `roleTexts[]` 中角色名的 `tag`、`cls`、`ancestors` 是否变化
4. 更新 `cursor_cdp.py` 中的选择器：
   - `_JS_EXTRACT_STATE`：角色扫描选择器
   - `_js_find_role_position()`：角色定位选择器
5. 重新打包测试

---

## 附录：源文件索引

| 文件 | 职责 |
|------|------|
| `cursor_cdp.py` | CDP 底层通信、DOM 提取 JS、高层 API（scan/click_role/type_and_send/press_enter） |
| `nudger.py` | 巡检主循环、CDP/OCR 切换调度、忙碌检测、打招呼、催办发送 |
| `cursor_vision.py` | OCR 扫描、侧栏识别、忙碌检测（降级通道） |
| `web_panel.py` | 面板 API、切换实测、CDP DOM 探查接口 |
| `cursor_embed.py` | Cursor 启动管理、CDP 端口检测与自动重启 |
