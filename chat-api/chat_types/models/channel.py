from dataclasses import dataclass
from datetime import datetime
from .author import Author


@dataclass
class Channel:
    # Unique identifier for the channel
    id: str | None = None
    # Display name of the channel
    name: str | None = None
    # Channel topic or description
    topic: str | None = None
    # When the channel was created
    created_at: datetime | None = None
    # When the channel was last updated
    updated_at: datetime | None = None
    # ID of the user who created the channel
    author_id: str | None = None
    author: Author | None = None
