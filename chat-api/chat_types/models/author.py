from dataclasses import dataclass
from datetime import datetime
from .status import Status


@dataclass
class Author:
    # Unique identifier for the author
    id: str | None = None
    # Display name of the author
    username: str | None = None
    # URL to the author's avatar image
    avatar_url: str | None = None
    # Biography or description of the author
    bio: str | None = None
    # When the author was created
    created_at: datetime | None = None
    # When the author was last updated
    updated_at: datetime | None = None
    # Current online status of the author
    status: Status | None = None
    # Color of the author
    color: str | None = None
    # Background color of the author's plate
    background_color: str | None = None
    # The author's total bytes
    bytes: int | None = None
