from typing import Any
import redis
from types.events import EventType, Union

async def publish_event(event: EventType, data: dict | Any):