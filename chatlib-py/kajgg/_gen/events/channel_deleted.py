from dataclasses import dataclass


@dataclass
class ChannelDeleted:
    # Unique identifier for the channel
    channel_id: str | None = None
