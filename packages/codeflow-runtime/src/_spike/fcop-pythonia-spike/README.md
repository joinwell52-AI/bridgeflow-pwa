# `_spike/fcop-pythonia-spike` — P4 sprint 调研 spike

**任务参考**：[TASK-20260511-005-PM-to-DEV](../../../../../docs/agents/tasks/TASK-20260511-005-PM-to-DEV.md)
**调研结论**：[REPORT-20260511-005-DEV-to-PM](../../../../../docs/agents/tasks/REPORT-20260511-005-DEV-to-PM.md)（完工时填）

## 这个目录是什么

ADMIN 5/11 拍板 **D7 = 选项 P**（CodeFlow runtime 通过 `pythonia` npm 包**同进程嵌入** Python 调 fcop@1.1.0），本目录是 PM 派给 DEV-001 的 P1 调研 spike，**目标是验证工程可行性**而非生产实现。

## 隔离规则

- ✅ **不进** runtime workspace 依赖图（`@codeflow/_spike-fcop-pythonia` 不被任何包 import）
- ✅ **不影响** runtime 112 测试（`npm test` 在 `packages/codeflow-runtime/` 跑不会触达本目录）
- ✅ **不动** 主 `package.json` dependencies（`pythonia` 装在本子目录的 `node_modules/`）
- ✅ **不向 fcop 提 issue / PR**（自约束 7：单点不构成涌现，所有不便记 surprise）
- ✅ **临时性**：P4 主 sprint（TASK-006+）启动后，spike 内代码可整体删除

## 文件清单

| 文件 | 用途 |
|---|---|
| `package.json` | 隔离子项目，独立 `pnpm install` / `npm install` |
| `tsconfig.json` | 仅本目录有效，宽松配置允许实验性代码 |
| `hello-fcop.ts` | 主交付 1：pythonia + fcop 最小可执行 |
| `demo-fcop-api.ts` | 主交付 2：5 个核心 fcop 调用 demo |
| `.gitignore` | 屏蔽 `node_modules/` + `D:/temp/codeflow-spike-project/` 等 spike 产物 |

## 跑法

### 前置

- Python 3.10+ 已装，**且 fcop@1.1.0 importable**
- Node 16+（系统 node v24.14.0 ✅）
- npm（系统有，pnpm 缺，TASK §3.1 写 `pnpm` 实际用 npm — 见 REPORT surprise）

### 一次性 setup

```powershell
cd packages/codeflow-runtime/src/_spike/fcop-pythonia-spike
npm install
```

### Windows 关键：让 pythonia 找到带 fcop 的 Python

本机 PATH 上 `python` = 3.9.5（无 fcop），实际 fcop 装在 `py -3` → Python 3.12.9。
pythonia 默认 spawn `python3` / `python`，**必须**通过 env var 指定 3.12 路径：

```powershell
$env:PYTHON_BIN = "C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe"
npm run hello
```

（pythonia 实际读取的 env var 见 hello-fcop.ts 注释里的真实查证。）

### 跑

```powershell
npm run hello   # 主交付 1
npm run demo    # 主交付 2
```

## 删除时机

P4 主 sprint（TASK-006）落地、CodeFlow runtime 已正式 `import { python } from 'pythonia'` 后，
PM 派任务正式删除本目录。在那之前**任何人**都不应 import 本目录中的代码到主代码树。
