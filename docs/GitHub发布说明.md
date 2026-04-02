# BridgeFlow GitHub 发布说明

## 仓库结构

| 仓库 | 地址 | 内容 |
|------|------|------|
| **主仓库** | https://github.com/joinwell52-ai/BridgeFlow | 全部源码 + 文档 |
| **PWA 部署仓库** | https://github.com/joinwell52-ai/bridgeflow-pwa | GitHub Pages（PWA 静态文件） |

---

## 一、首次建立 GitHub 仓库

### 1. 创建主仓库

1. 登录 https://github.com/joinwell52-ai
2. 点 **New repository**
3. 填写：
   - Repository name: `BridgeFlow`
   - Description: `BridgeFlow — 手机主控 + PC 执行机 + 文件协议的多 AI 角色人机协作桥接工具`
   - Public（推荐开源）
   - **不要**勾选 Initialize with README（本地已有）
4. 点 **Create repository**

### 2. 关联本地仓库并推送

```powershell
cd D:\BridgeFlow
git remote add origin https://github.com/joinwell52-ai/BridgeFlow.git
git branch -M main
git push -u origin main
```

### 3. 创建 PWA 部署仓库

1. 同样在 GitHub 新建仓库 `bridgeflow-pwa`
2. 勾选 **Add a README file**（必须有初始提交才能开启 Pages）
3. 进入仓库 **Settings → Pages**
4. Source 选 **Deploy from a branch**，Branch 选 `main`，目录选 `/ (root)`
5. 保存，GitHub 会分配域名：`https://joinwell52-ai.github.io/bridgeflow-pwa/`

---

## 二、分支策略

### 主仓库（BridgeFlow）

| 分支 | 说明 | 保护策略 |
|------|------|----------|
| `main` | 稳定发布分支 | 不直接推送，通过 PR 合入 |
| `dev` | 日常开发分支 | 可直接推送 |
| `feature/*` | 功能分支 | 开发完后 PR 到 dev |
| `hotfix/*` | 紧急修复 | 直接 PR 到 main |

### 发版流程

```
dev → PR → main → 打 tag (v*) → GitHub Actions 自动发布 PyPI
```

### PWA 部署仓库（bridgeflow-pwa）

- 只有 `main` 分支
- 每次更新 PWA 内容时，手动或 CI 推送到此仓库
- GitHub Pages 自动部署根目录

---

## 三、GitHub Actions 自动化

本仓库配置了两条 CI/CD 流水线：

### `.github/workflows/publish.yml` — 自动发布到 PyPI

**触发条件：** 推送 `v*` 格式的 tag（如 `v0.2.0`）

**流程：**
1. Checkout 代码
2. 安装 `build` 和 `twine`
3. 构建 wheel + sdist
4. 用 `PYPI_API_TOKEN` secret 上传到 PyPI

**配置前提：**
- 在仓库 **Settings → Secrets → Actions** 中添加 `PYPI_API_TOKEN`
- PyPI token 来源：https://pypi.org → Account Settings → API tokens

### `.github/workflows/deploy-pwa.yml` — 自动部署 PWA 到 GitHub Pages

**触发条件：** `main` 分支推送时，且 `web/pwa/` 目录有变更

**流程：**
1. Checkout 代码
2. 将 `web/pwa/` 目录内容推送到 `bridgeflow-pwa` 仓库的 `main` 分支
3. GitHub Pages 自动刷新

**配置前提：**
- 在仓库 **Settings → Secrets → Actions** 中添加 `PAGES_DEPLOY_TOKEN`
- Token 类型：Personal Access Token（classic），勾选 `repo` 权限

---

## 四、日常更新工作流

### 推送 PC 端代码更新

```powershell
cd D:\BridgeFlow
git add .
git commit -m "feat: 新增某功能"
git push origin dev
# 在 GitHub 上创建 PR: dev → main
```

### 发布新版本（PC 端 Python 包）

```powershell
# 1. 更新版本号
# 修改 pyproject.toml 中的 version = "x.x.x"
# 更新 CHANGELOG.md

# 2. 提交
git add pyproject.toml CHANGELOG.md
git commit -m "chore: release vX.X.X"

# 3. 打 tag 并推送（触发 GitHub Actions 自动发布到 PyPI）
git tag vX.X.X
git push origin main --tags
```

### 更新 PWA（手机端）

```powershell
# 修改 web/pwa/ 下的文件后，记得更新 config.js 中的 appVersion
# 然后提交到 main 分支，GitHub Actions 自动部署

git add web/pwa/
git commit -m "feat(pwa): 更新某页面 vX.X.X"
git push origin main
```

---

## 五、版本对应关系

| 模块 | 版本来源 | 更新时机 |
|------|----------|----------|
| Python 包 | `pyproject.toml` → `version` | 发布 PyPI 时 |
| PWA | `web/pwa/config.js` → `appVersion` | 每次修改 PWA 文件时 |
| CHANGELOG | `CHANGELOG.md` | 每次发版时 |
| Git tag | `vX.X.X` | 与 pyproject.toml version 保持一致 |

> **PWA appVersion 必须每次改动都递增**，否则 Service Worker 不更新缓存，手机端看到的还是旧版。

---

## 六、Secrets 配置汇总

| Secret 名称 | 用途 | 来源 |
|-------------|------|------|
| `PYPI_API_TOKEN` | 上传到 PyPI | https://pypi.org → API tokens |
| `PAGES_DEPLOY_TOKEN` | 推送到 bridgeflow-pwa 仓库 | GitHub PAT（classic，`repo` 权限） |

---

## 七、本地 clone 开发

```powershell
git clone https://github.com/joinwell52-ai/BridgeFlow.git D:\BridgeFlow-dev
cd D:\BridgeFlow-dev
py -3.10 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
bridgeflow init
bridgeflow run
```
