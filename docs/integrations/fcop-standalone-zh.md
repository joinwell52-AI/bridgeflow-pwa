# FCoP 与 Bridgeflow（CodeFlow）的分工

> **写死边界**：分仓以后，**协议 + MCP = FCoP**；**手机驭 AI 工具 = 本仓（工具项目）**。两边不再混成「一个工作树里两套主工程」。

## FCoP 是什么（完全独立）

- **仓库**：[github.com/joinwell52-AI/FCoP](https://github.com/joinwell52-AI/FCoP)（独立 Git、独立发版、独立 Issue/PR）
- **内容**：
  - **协议**：文件驱动协作的规范、论文、规范性格式（如 `.mdc`、团队模板等）
  - **MCP 与双包**：
    - **`fcop`**：协议与 Python 库（`Project` / 任务与公文等 API）
    - **`fcop-mcp`**：把上述能力暴露给 Cursor / 其他 MCP 客户端
- **本机开发**：若你盘上有独立工作区（例如 `D:\FCoP`），**以 FCoP 仓为唯一权威**，与 Bridgeflow 是否还带有历史目录无关。

## Bridgeflow / CodeFlow 本仓是什么

- **定位**：**工具项目** —— CodeFlow Desktop、PWA、中继联调、产品文档与发版等，**面向「能跑、能下、能连」的交付**。
- **与 FCoP 的关系**：
  - 消费协议：在业务项目里**安装** `fcop` / `fcop-mcp`（或参考文档把规则抄进 `.cursor`），不替代 FCoP 仓的演进主线。
  - 本仓内如仍有 `codeflow-plugin/` 等历史路径，仅作**兼容/迁移期**引用；**新规范、新包版本、MCP 行为**一律以 **FCoP 仓** 为准。

## 文档与发版往哪看

| 想做的事 | 去哪 |
|----------|------|
| 改协议、改 `fcop` / `fcop-mcp`、发 PyPI、开协议相关 issue | **FCoP 仓**（及仓内 `docs/`，如 `docs/release-process.md`） |
| 发 CodeFlow Desktop / PWA、本工具链 | **本仓** [docs/release-process.md](../release-process.md)（**仅**工具线，不覆盖 FCoP 双包） |

## 小结

- **FCoP = 协议 + `fcop` + `fcop-mcp`**，**独立**。
- **Bridgeflow = 工具项目**，**独立**。
- 分开后，按上表和 README 里「本仓与 FCoP 的关系」对照，**不应再乱**。
