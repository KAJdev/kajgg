from dataclasses import dataclass
from datetime import datetime


@dataclass
class Channel:
    # Unique identifier for the channel
    id: str
    # Display name of the channel
    name: str
    # Channel topic or description
    topic: str
    # When the channel was created
    created_at: datetime
    # When the channel was last updated
    updated_at: datetime
    # ID of the user who created the channel
    author_id: str
