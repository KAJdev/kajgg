from dataclasses import dataclass


@dataclass
class TypingStarted:
    # Unique identifier for the channel
    channel_id: str | None = None
    # Unique identifier for the user
    user_id: str | None = None
