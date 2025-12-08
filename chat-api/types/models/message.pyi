from dataclasses import dataclass
from datetime import datetime
from .file import File


@dataclass
class Message:
    # Unique identifier for the message
    id: str
    # Text content of the message
    content: str
    # List of files attached to the message
    files: list[File]
    # When the message was created
    created_at: datetime
    # When the message was last updated
    updated_at: datetime
    # ID of the user who sent the message
    author_id: str
    # ID of the channel this message belongs to
    channel_id: str
