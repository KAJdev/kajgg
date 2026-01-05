from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from .client import KajggClient


@dataclass
class Context:
    # shared event context bits
    client: KajggClient
    raw: dict[str, Any]
    ts: Optional[int] = None


