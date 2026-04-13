# -*- coding: utf-8 -*-
"""
一键发版：打包 → GitHub → Gitee → PWA 同步
用法：cd codeflow-desktop && python publish.py
"""
import subprocess, sys, os, re, shutil
from pathlib import Path

ROOT = Path(__file__).parent
BRIDGEFLOW = ROOT.parent
PWA_SRC = BRIDGEFLOW / "web" / "pwa"
PWA_PUB = Path("d:/bridgeflow-pwa-publish")

def run(cmd, **kw):
    print(f"\n{'='*60}\n>>> {cmd}\n{'='*60}")
    r = subprocess.run(cmd, shell=True, cwd=kw.get("cwd", ROOT))
    if r.returncode != 0:
        print(f"!!! 命令失败 (exit {r.returncode})")
        sys.exit(1)

def get_version():
    text = (ROOT / "main.py").read_text(encoding="utf-8")
    m = re.search(r'VERSION\s*=\s*["\']([^"\']+)["\']', text)
    return m.group(1) if m else "0.0.0"

VER = get_version()
TAG = f"v{VER}"
EXE = ROOT / "dist" / "CodeFlow-Desktop.exe"

print(f"\n===== CodeFlow Desktop 发版 {TAG} =====\n")

# 1. 打包
print("\n[1/4] PyInstaller 打包 ...")
run("py -3.10 -m PyInstaller build.spec --noconfirm")
size_mb = EXE.stat().st_size / (1024 * 1024)
print(f"  EXE 大小: {size_mb:.1f} MB")
if size_mb > 50:
    print("!!! EXE 太大，检查 build.spec")
    sys.exit(1)

# 2. GitHub 发版
print("\n[2/4] 发布到 GitHub ...")
run("python _github_pub.py")

# 3. Gitee 发版
print("\n[3/4] 发布到 Gitee ...")
run("python _gitee_pub.py")

# 4. PWA 同步推送
print("\n[4/4] PWA 同步到 GitHub Pages ...")
if PWA_PUB.exists():
    for f in ["index.html", "config.js", "sw.js", "manifest.json"]:
        src = PWA_SRC / f
        dst = PWA_PUB / f
        if src.exists():
            shutil.copy2(src, dst)
    run("git add -A", cwd=PWA_PUB)
    run(f'git -c "trailer.ifExists=doNothing" commit -m "{TAG}: sync PWA" --allow-empty', cwd=PWA_PUB)
    run("git push origin main", cwd=PWA_PUB)
else:
    print(f"  PWA 发布目录不存在: {PWA_PUB}，跳过")

print(f"\n{'='*60}")
print(f"  发版完成！{TAG}")
print(f"  GitHub: https://github.com/joinwell52-AI/codeflow-pwa/releases/tag/{TAG}")
print(f"  Gitee:  https://gitee.com/joinwell52/cursor-ai/releases/tag/{TAG}")
print(f"{'='*60}")
