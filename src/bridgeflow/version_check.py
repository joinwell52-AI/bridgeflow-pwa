"""
版本检查模块：启动时后台查询 PyPI，有新版本时在控制台提示。

设计原则：
- 后台线程执行，不阻塞启动流程
- 网络不可用时静默失败，不报错
- 每 24 小时最多查一次（结果缓存到 runtime 目录）
- 查询超时 5 秒
"""
from __future__ import annotations

import json
import threading
import time
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from bridgeflow import __version__

PYPI_URL = "https://pypi.org/pypi/bridgeflow/json"
CACHE_FILE_NAME = "version_check_cache.json"
CHECK_INTERVAL_HOURS = 24
REQUEST_TIMEOUT_SECONDS = 5


def _parse_version(v: str) -> tuple[int, ...]:
    """将版本字符串转为可比较的元组，如 '0.1.8' → (0, 1, 8)。"""
    try:
        return tuple(int(x) for x in v.strip().split("."))
    except Exception:
        return (0,)


def _load_cache(cache_path: Path) -> dict:
    try:
        if cache_path.exists():
            return json.loads(cache_path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}


def _save_cache(cache_path: Path, data: dict) -> None:
    try:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


def _fetch_latest_version() -> Optional[str]:
    """从 PyPI 获取最新版本号，失败返回 None。"""
    try:
        req = urllib.request.Request(
            PYPI_URL,
            headers={"Accept": "application/json", "User-Agent": f"bridgeflow/{__version__}"},
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["info"]["version"]
    except Exception:
        return None


def _should_check(cache: dict) -> bool:
    """判断是否需要重新查询 PyPI（距上次检查超过 24 小时）。"""
    last_checked = cache.get("last_checked")
    if not last_checked:
        return True
    try:
        last_dt = datetime.fromisoformat(last_checked)
        return datetime.now() - last_dt > timedelta(hours=CHECK_INTERVAL_HOURS)
    except Exception:
        return True


def _print_upgrade_hint(latest: str) -> None:
    """打印升级提示（带视觉突出）。"""
    print()
    print("  ┌─────────────────────────────────────────────────┐")
    print(f"  │  💡 新版本可用：v{latest}（当前 v{__version__}）")
    print(f"  │  升级命令：pip install --upgrade bridgeflow")
    print("  └─────────────────────────────────────────────────┘")
    print()


def check_update_async(runtime_dir: Optional[str] = None) -> None:
    """
    在后台线程中检查版本更新，有新版时打印提示。
    非阻塞，调用后立即返回。

    Args:
        runtime_dir: 缓存文件存放目录，None 时使用系统临时目录
    """
    def _worker() -> None:
        try:
            if runtime_dir:
                cache_path = Path(runtime_dir) / CACHE_FILE_NAME
            else:
                import tempfile
                cache_path = Path(tempfile.gettempdir()) / "bridgeflow" / CACHE_FILE_NAME

            cache = _load_cache(cache_path)

            if not _should_check(cache):
                # 用缓存结果判断
                latest = cache.get("latest_version")
                if latest and _parse_version(latest) > _parse_version(__version__):
                    _print_upgrade_hint(latest)
                return

            # 查询 PyPI
            latest = _fetch_latest_version()

            # 更新缓存
            cache["last_checked"] = datetime.now().isoformat()
            if latest:
                cache["latest_version"] = latest
            _save_cache(cache_path, cache)

            if latest and _parse_version(latest) > _parse_version(__version__):
                _print_upgrade_hint(latest)

        except Exception:
            pass  # 版本检查失败不影响主流程

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()
    # 稍等片刻让后台线程有机会在启动横幅后打印（非阻塞）
    time.sleep(0.3)
