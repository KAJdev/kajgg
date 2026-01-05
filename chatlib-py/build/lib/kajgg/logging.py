from __future__ import annotations

import logging
import os
import sys
from datetime import datetime


class _PrettyFormatter(logging.Formatter):
    # tiny pretty formatter with optional color, nothing fancy

    COLORS = {
        "DEBUG": "\x1b[38;5;245m",
        "INFO": "\x1b[38;5;40m",
        "WARNING": "\x1b[38;5;214m",
        "ERROR": "\x1b[38;5;196m",
        "CRITICAL": "\x1b[38;5;196m",
    }
    RESET = "\x1b[0m"

    def __init__(self, *, use_color: bool):
        super().__init__()
        self.use_color = use_color

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.fromtimestamp(record.created).strftime("%H:%M:%S")
        lvl = record.levelname
        name = record.name
        msg = record.getMessage()

        if self.use_color:
            c = self.COLORS.get(lvl, "")
            lvl = f"{c}{lvl.lower():>8}{self.RESET}"
        else:
            lvl = f"{lvl.lower():>8}"

        out = f"{ts} {lvl} {name}: {msg}"
        if record.exc_info:
            out += "\n" + self.formatException(record.exc_info)
        return out


def setup_logging(level: str | None = None, *, force: bool = False) -> None:
    # call this once at startup if you want pretty logs
    root = logging.getLogger()
    if root.handlers and not force:
        return

    level = level or os.getenv("KAJGG_LOG_LEVEL") or "INFO"
    root.setLevel(level.upper())

    handler = logging.StreamHandler(sys.stdout)
    use_color = bool(sys.stdout.isatty())
    handler.setFormatter(_PrettyFormatter(use_color=use_color))
    root.handlers = [handler]
