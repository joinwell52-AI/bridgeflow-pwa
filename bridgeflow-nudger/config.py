"""
CodeFlow Nudger 配置模块
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class NudgerConfig:
    project_dir: Path = field(default_factory=lambda: Path.cwd())
    relay_url: str = "wss://ai.chedian.cc/codeflow/ws/"
    room_key: str = ""
    device_id: str = "codeflow-nudger"
    # 巡检主循环：扫描 tasks/reports/issues 的间隔（秒）
    poll_interval: float = 5.0
    nudge_cooldown: float = 15.0
    lang: str = "zh"
    # 查找 Cursor 窗口（预检与催办共用）
    find_cursor_max_attempts: int = 4
    find_cursor_retry_delay_s: float = 0.12
    # 每 N 轮主循环执行一次：idle 自动「继续」/ 卡住任务催促
    idle_check_every_n: int = 6
    stuck_check_every_n: int = 30
    # 若已安装 watchdog，则监听目录 .md 变更并打断睡眠，加快响应新文件
    use_file_watcher: bool = True

    hotkeys: dict[str, tuple] = field(default_factory=lambda: {
        "PM":  ("ctrl", "alt", "1"),
        "DEV": ("ctrl", "alt", "2"),
        "QA":  ("ctrl", "alt", "3"),
        "OPS": ("ctrl", "alt", "4"),
    })

    input_offset: tuple[float, float] = (0.80, 55)

    @property
    def agents_dir(self) -> Path:
        return self.project_dir / "docs" / "agents"

    @property
    def tasks_dir(self) -> Path:
        return self.agents_dir / "tasks"

    @property
    def reports_dir(self) -> Path:
        return self.agents_dir / "reports"

    @property
    def issues_dir(self) -> Path:
        return self.agents_dir / "issues"

    @property
    def log_dir(self) -> Path:
        return self.agents_dir / "log"
