from dataclasses import dataclass
from datetime import datetime
from .status import Status


@dataclass
class Author:
    # Unique identifier for the author
    id: str
    # Display name of the author
    username: str
    # URL to the author's avatar image
    avatar_url: str | None
    # Biography or description of the author
    bio: str | None
    # When the author was created
    created_at: datetime
    # When the author was last updated
    updated_at: datetime
    # Current online status of the author
    status: Status
