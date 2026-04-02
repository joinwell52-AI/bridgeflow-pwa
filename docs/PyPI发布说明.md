# BridgeFlow PyPI 发布说明

## 概述

| 渠道 | 地址 | 内容 |
|------|------|------|
| PyPI | https://pypi.org/project/bridgeflow/ | Python 包（PC 端 CLI） |
| GitHub | https://github.com/joinwell52-ai/BridgeFlow | 源码仓库 |

**PyPI 只发布 Python 包**，PWA 静态页面通过 GitHub Pages 单独发布（见 `GitHub发布说明.md`）。

---

## 发布方式

### 方式一：GitHub Actions 自动发布（推荐）

推送 tag 后自动触发：

```powershell
# 1. 更新 pyproject.toml 中的 version
# 2. 更新 CHANGELOG.md
# 3. 提交 + 打 tag + 推送
git add pyproject.toml CHANGELOG.md
git commit -m "chore: release v0.2.0"
git tag v0.2.0
git push origin main --tags
```

GitHub Actions（`.github/workflows/publish.yml`）检测到 `v*` tag 后，自动：
1. 构建 wheel + sdist
2. 上传到 PyPI（通过 `PYPI_API_TOKEN` secret）

### 方式二：手动发布

```powershell
# 进入项目根目录
cd D:\BridgeFlow

# 确认使用 Python 3.10
py -3.10 --version

# 安装发布工具（只需一次）
py -3.10 -m pip install --upgrade build twine

# 清理旧构建产物
Remove-Item -Recurse -Force dist, build, src\bridgeflow.egg-info -ErrorAction SilentlyContinue

# 构建（同时生成 .whl 和 .tar.gz）
py -3.10 -m build

# 检查包内容
py -3.10 -m twine check dist/*

# 上传到 PyPI（需要 PyPI 账号 token）
py -3.10 -m twine upload dist/*
```

---

## 发布前检查清单

```
[ ] pyproject.toml 中 version 已更新
[ ] CHANGELOG.md 中已添加本版本条目
[ ] src/bridgeflow/data/rules/ 包含最新 5 个 .mdc 规则文件
[ ] src/bridgeflow/data/bridgeflow_config.json 中无生产密钥
[ ] web/pwa/config.js 中 appVersion 已同步更新
[ ] 本地 bridgeflow init && bridgeflow run 验证通过
```

---

## PyPI 账号与 Token

1. 登录 https://pypi.org（注册账号：joinwell52-ai）
2. 进入 **Account Settings → API tokens**
3. 点 **Add API token**，作用域选 `Entire account`（首次）或指定 `bridgeflow` 项目
4. 复制 token（格式 `pypi-...`），**只显示一次**

### 本地上传配置

创建或编辑 `~/.pypirc`（Windows: `C:\Users\Administrator\.pypirc`）：

```ini
[distutils]
index-servers = pypi

[pypi]
username = __token__
password = pypi-AgEI...（你的完整 token）
```

> 有了 `.pypirc` 后，`twine upload` 不再需要交互输入。

### GitHub Actions Secret 配置

1. 打开 GitHub 仓库 → **Settings → Secrets and variables → Actions**
2. 点 **New repository secret**
3. Name: `PYPI_API_TOKEN`，Value: 粘贴 token
4. 保存

---

## 版本号规范

遵循 [语义化版本](https://semver.org/lang/zh-CN/)：

| 变更类型 | 版本示例 | 说明 |
|----------|----------|------|
| 修复 bug | `0.1.8 → 0.1.9` | patch 版本 |
| 新功能（向后兼容） | `0.1.8 → 0.2.0` | minor 版本 |
| 破坏性变更 | `0.x → 1.0.0` | major 版本 |

**注意**：PyPI 上已发布的版本号不能覆盖，必须递增。

---

## 构建说明

### 包含内容（`pyproject.toml` 控制）

```toml
[tool.setuptools.package-data]
bridgeflow = ["data/*.json", "data/rules/*.mdc", "dashboard/*.html"]
```

| 路径 | 说明 |
|------|------|
| `src/bridgeflow/` | Python 包主体 |
| `src/bridgeflow/data/bridgeflow_config.json` | 默认配置模板 |
| `src/bridgeflow/data/rules/*.mdc` | 5 个角色 Cursor 规则（`bridgeflow init` 时复制） |
| `src/bridgeflow/dashboard/index.html` | 本地仪表盘页面 |

### 不包含的内容

- `web/pwa/` — PWA 源码，通过 GitHub Pages 单独发布
- `docs/` — 文档，只在 GitHub 仓库
- `server/relay/` — 本地联调中继，不打包
- `_smoke_test/` — 测试目录，不打包
- `.cursor/` — Cursor 规则（打包版在 `data/rules/`）

---

## 验证发布结果

```powershell
# 新建虚拟环境验证
py -3.10 -m venv _test_install
_test_install\Scripts\Activate.ps1
pip install bridgeflow==0.2.0
bridgeflow --help
bridgeflow init
deactivate
Remove-Item -Recurse -Force _test_install
```

---

## 回滚方案

PyPI 不支持删除已发布版本，如果版本有严重问题：

1. 立即发布修复版本（如 `0.2.1`）
2. 在 PyPI 上 yank 问题版本（标记为"不推荐"，`pip install` 默认跳过）
3. 在 CHANGELOG.md 中注明
