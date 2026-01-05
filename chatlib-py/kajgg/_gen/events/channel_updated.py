from dataclasses import dataclass
from ..models.channel import Channel


@dataclass
class ChannelUpdated:
    channel: Channel | None = None
