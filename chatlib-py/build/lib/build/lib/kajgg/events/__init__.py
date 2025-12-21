from __future__ import annotations

from typing import Any

from .._internal.convert import dataclass_from_dict
from ..client import KajggClient
from ..context import Context
from .._gen.events.event_type import EventType

from .._gen.events.author_updated import AuthorUpdated as _AuthorUpdated
from .._gen.events.channel_created import ChannelCreated as _ChannelCreated
from .._gen.events.channel_deleted import ChannelDeleted as _ChannelDeleted
from .._gen.events.channel_updated import ChannelUpdated as _ChannelUpdated
from .._gen.events.message_created import MessageCreated as _MessageCreated
from .._gen.events.message_deleted import MessageDeleted as _MessageDeleted
from .._gen.events.message_updated import MessageUpdated as _MessageUpdated
from .._gen.events.typing_started import TypingStarted as _TypingStarted


class _ContextMixin:
    # yeah this is jank but it keeps the handler param type = event type
    client: KajggClient
    raw: dict[str, Any]
    ts: int | None

    def _attach(self, ctx: Context) -> None:
        self.client = ctx.client
        self.raw = ctx.raw
        self.ts = ctx.ts


class MessageCreated(_MessageCreated, _ContextMixin):
    async def send(self, content: str, **kwargs: Any):
        # respond in the same channel, ez
        if not self.message or not getattr(self.message, "channel_id", None):
            raise RuntimeError("missing channel_id on message")
        return await self.client.send_message(
            self.message.channel_id, content, **kwargs
        )


class MessageUpdated(_MessageUpdated, _ContextMixin):
    pass


class MessageDeleted(_MessageDeleted, _ContextMixin):
    pass


class ChannelCreated(_ChannelCreated, _ContextMixin):
    pass


class ChannelUpdated(_ChannelUpdated, _ContextMixin):
    pass


class ChannelDeleted(_ChannelDeleted, _ContextMixin):
    pass


class AuthorUpdated(_AuthorUpdated, _ContextMixin):
    pass


class TypingStarted(_TypingStarted, _ContextMixin):
    pass


_EVENT_CLASS_BY_TYPE: dict[EventType, type] = {
    EventType.MESSAGE_CREATED: MessageCreated,
    EventType.MESSAGE_UPDATED: MessageUpdated,
    EventType.MESSAGE_DELETED: MessageDeleted,
    EventType.CHANNEL_CREATED: ChannelCreated,
    EventType.CHANNEL_UPDATED: ChannelUpdated,
    EventType.CHANNEL_DELETED: ChannelDeleted,
    EventType.AUTHOR_UPDATED: AuthorUpdated,
    EventType.TYPING_STARTED: TypingStarted,
}


def parse_event_data(event_type: EventType, data: dict[str, Any]) -> Any:
    cls = _EVENT_CLASS_BY_TYPE.get(event_type)
    if not cls:
        return data
    return dataclass_from_dict(cls, data)


__all__ = [
    "AuthorUpdated",
    "ChannelCreated",
    "ChannelDeleted",
    "ChannelUpdated",
    "EventType",
    "MessageCreated",
    "MessageDeleted",
    "MessageUpdated",
    "TypingStarted",
    "parse_event_data",
]
