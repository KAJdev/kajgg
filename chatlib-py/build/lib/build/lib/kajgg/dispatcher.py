from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any, Awaitable, Callable

from .events import EventType

Handler = Callable[[Any], Awaitable[None]]

_handlers: dict[EventType, list[Handler]] = defaultdict(list)


def listen(event_type: EventType):
    # decorator vibe
    def deco(fn: Handler) -> Handler:
        _handlers[event_type].append(fn)
        return fn

    return deco


async def dispatch(event_type: EventType, ctx: Any) -> None:
    handlers = list(_handlers.get(event_type, []))
    if not handlers:
        return

    for fn in handlers:
        try:
            await fn(ctx)
        except asyncio.CancelledError:
            raise
        except Exception:
            logging.exception("handler blew up")
