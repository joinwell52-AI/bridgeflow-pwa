# -*- coding: utf-8 -*-
"""上传 EXE 到 Gitee Release"""
import json
import os
import sys
import urllib.request

TOKEN    = "f9e975523ed0d3adf4b4f13c224412d0"
OWNER    = "joinwell52"
REPO     = "cursor-ai"
TAG      = "v2.9.29"
EXE_PATH = "dist/CodeFlow-Desktop.exe"

NOTES = """\
## v2.9.29

### 修复：自动更新下载走系统代理（VPN）
- 版本检查和文件下载均读取系统代理设置，VPN 环境下不再卡在 0%
- 修复 socket 超时未覆盖跳转阶段导致卡死的问题

### 下载
- Gitee（国内快）：见本页附件 CodeFlow-Desktop.exe
- GitHub：https://github.com/joinwell52-AI/codeflow-pwa/releases/tag/v2.9.29
"""


def api(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    if method:
        req.method = method
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def create_release():
    url = f"https://gitee.com/api/v5/repos/{OWNER}/{REPO}/releases"
    payload = json.dumps({
        "access_token": TOKEN,
        "tag_name": TAG,
        "name": f"{TAG} - 修复更新走系统代理(VPN)",
        "body": NOTES,
        "prerelease": False,
        "target_commitish": "main",
    }).encode("utf-8")
    return api(url, data=payload, headers={
        "Content-Type": "application/json;charset=utf-8",
        "User-Agent": "CodeFlow",
    })


def upload_asset(release_id):
    url = f"https://gitee.com/api/v5/repos/{OWNER}/{REPO}/releases/{release_id}/attach_files"
    boundary = "----CFBoundary7788"
    sep = f"--{boundary}\r\n".encode()
    end = f"--{boundary}--\r\n".encode()

    with open(EXE_PATH, "rb") as f:
        exe_data = f.read()

    body = b""
    # access_token field
    body += sep
    body += b'Content-Disposition: form-data; name="access_token"\r\n\r\n'
    body += TOKEN.encode() + b"\r\n"
    # file field
    body += sep
    body += b'Content-Disposition: form-data; name="file"; filename="CodeFlow-Desktop.exe"\r\n'
    body += b"Content-Type: application/octet-stream\r\n\r\n"
    body += exe_data + b"\r\n"
    body += end

    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "User-Agent": "CodeFlow",
    })
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read())


if __name__ == "__main__":
    # 先检查是否已有 release
    print(f"[1/2] 创建 Gitee Release {TAG} ...")
    try:
        rel = create_release()
        rel_id = rel["id"]
        print(f"      Release 创建成功，ID={rel_id}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        if "400" in str(e.code) or "422" in str(e.code) or "already" in body:
            print("      Release 已存在，查询 ID ...")
            data = api(
                f"https://gitee.com/api/v5/repos/{OWNER}/{REPO}/releases/tags/{TAG}?access_token={TOKEN}",
                headers={"User-Agent": "CodeFlow"},
            )
            rel_id = data["id"]
            print(f"      已有 Release ID={rel_id}")
        else:
            print(f"      创建失败: {e.code} {body}")
            sys.exit(1)

    size_mb = round(os.path.getsize(EXE_PATH) / 1024 / 1024, 1)
    print(f"[2/2] 上传 {EXE_PATH} ({size_mb} MB) ...")
    result = upload_asset(rel_id)
    print(f"      上传成功！下载地址：{result.get('browser_download_url', result)}")
    print(f"\nGitee Release 页：https://gitee.com/{OWNER}/{REPO}/releases/tag/{TAG}")
