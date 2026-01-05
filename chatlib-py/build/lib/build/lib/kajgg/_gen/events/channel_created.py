from dataclasses import dataclass
from ..models.channel import Channel


@dataclass
class ChannelCreated:
    channel: Channel | None = None
