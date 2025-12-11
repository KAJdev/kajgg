from dataclasses import dataclass
from datetime import datetime
from .author import Author
from .channel import Channel
from .file import File
from .message_type import MessageType


@dataclass
class Message:
    # Unique identifier for the message
    id: str | None = None
    # Type of the message
    type: MessageType | None = None
    # Text content of the message
    content: str | None = None
    # List of files attached to the message
    files: list[File] | None = None
    # When the message was created
    created_at: datetime | None = None
    # When the message was last updated
    updated_at: datetime | None = None
    # ID of the user who sent the message
    author_id: str | None = None
    # ID of the channel this message belongs to
    channel_id: str | None = None
    # Nonce for the message
    nonce: str | None = None
    author: Author | None = None
    channel: Channel | None = None
