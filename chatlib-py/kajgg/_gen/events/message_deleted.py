from dataclasses import dataclass


@dataclass
class MessageDeleted:
    # Unique identifier for the message
    message_id: str | None = None
    # Unique identifier for the channel
    channel_id: str | None = None
