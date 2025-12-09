from dataclasses import asdict, dataclass, fields
import time
import asyncio
from collections import defaultdict
import json
from typing import Any
from modules.kv import publish, get_client
from chat_types.events import (
    EventType,
    MessageCreated,
    MessageUpdated,
    ChannelCreated,
)
from modules.db import Channel, User
from modules.utils import (
    dataclass_from_dict,
    dtoa,
    convert_enums_to_strings,
    convert_dates_to_iso,
)
import logging


@dataclass
class UserEntitlements:
    channels: set[str]

    @classmethod
    async def from_user(cls, user: User):
        user_channels = await Channel.get_user_channels(user.id)
        return cls(channels=set(channel.id for channel in user_channels))

    def validate(self, event: MessageCreated | MessageUpdated | ChannelCreated):
        if event.channel.id not in self.channels:
            return False
        return True


EVENT_TYPES = {
    MessageCreated: EventType.MESSAGE_CREATED,
    MessageUpdated: EventType.MESSAGE_UPDATED,
    ChannelCreated: EventType.CHANNEL_CREATED,
}

EVENT_CLASSES = {v: k for k, v in EVENT_TYPES.items()}

user_entitlements: dict[str, UserEntitlements] = {}
writers = defaultdict(set)


def publish_event(event: MessageCreated | MessageUpdated | ChannelCreated):
    """
    used by an API server to fan out events to gateway nodes
    """

    asyncio.create_task(
        publish(
            {
                "t": EVENT_TYPES[type(event)].value,
                "d": json.dumps(
                    convert_enums_to_strings(convert_dates_to_iso(asdict(event))),
                    separators=(",", ":"),
                    indent=None,
                ),
                "ts": str(int(time.time() * 1000)),
            }
        )
    )


def parse_event(fields: dict) -> tuple[EventType, dict, Any]:
    raw_event_data = {
        "t": fields[b"t"].decode("utf-8"),
        "d": fields[b"d"].decode("utf-8"),
        "ts": fields[b"ts"].decode("utf-8"),
    }

    event = json.loads(raw_event_data["d"])
    raw_event_data["d"] = event
    event_type = EventType(raw_event_data["t"])

    return (
        event_type,
        raw_event_data,
        dataclass_from_dict(EVENT_CLASSES[event_type], event),
    )


async def update_user_entitlements(user: User):
    user_entitlements[user.id] = await UserEntitlements.from_user(user)


def add_writer(user_id: str, writer: asyncio.StreamWriter):
    writers[user_id].add(writer)


def remove_writer(user_id: str, writer: asyncio.StreamWriter):
    writers[user_id].discard(writer)
    if not writers[user_id] and user_id in user_entitlements:
        del user_entitlements[user_id]


def _format_sse(evt: dict) -> str:
    return f"data: {json.dumps(evt, separators=(',', ':'), indent=None)}\n\n"


async def _send_event(writer: asyncio.StreamWriter, evt: dict):
    await writer.send(_format_sse(evt))


async def _stream_live_events(start_id: str = "$"):
    """
    Async generator yielding new events forever.
    """
    last_id = start_id

    while True:
        results = await get_client().xread(
            streams={"events": last_id}, block=30_000  # wait up to 30s for new events
        )

        for _, entries in results:
            for event_id, fields in entries:
                last_id = event_id

                yield parse_event(fields)


async def _replay_events_since(last_event_id: str):
    """
    Yield all events after last_event_id
    """
    entries = await get_client().xrange("events", min=last_event_id, max="+")

    for _, fields in entries:
        yield parse_event(fields)


async def replay_events(user_id: str, writer: asyncio.StreamWriter, last_event_ts: int):
    entitlements = user_entitlements.get(user_id)
    if not entitlements:
        return
    async for event_type, raw_event_data, event in _replay_events_since(last_event_ts):
        logging.info(f" ---> REPLAYING EVENT: {event_type.value}")
        if entitlements.validate(event):
            await _send_event(
                writer,
                raw_event_data,
            )


def handle_channel_created(event: ChannelCreated):
    if event.channel.author_id in user_entitlements:
        user_entitlements[event.channel.author_id].channels.add(event.channel.id)


EVENT_HANDLERS = {
    EventType.CHANNEL_CREATED: handle_channel_created,
}


async def event_listener():
    async for event_type, raw_event_data, event in _stream_live_events():
        logging.info(f" ---> RECEIVED EVENT: {event_type.value}")
        if handler := EVENT_HANDLERS.get(event_type):
            handler(event)

        for user_id, entitlements in user_entitlements.items():
            if entitlements.validate(event):
                for writer in writers[user_id]:
                    asyncio.create_task(
                        _send_event(
                            writer,
                            raw_event_data,
                        )
                    )


def init():
    asyncio.create_task(event_listener())
