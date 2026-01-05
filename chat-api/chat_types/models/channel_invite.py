from dataclasses import dataclass
from datetime import datetime


@dataclass
class ChannelInvite:
    # Unique identifier for the invite
    id: str | None = None
    # ID of the channel this invite belongs to
    channel_id: str | None = None
    # ID of the user who created the invite
    author_id: str | None = None
    # When the invite was created
    created_at: datetime | None = None
    # Code for the invite
    code: str | None = None
    # When the invite expires
    expires_at: datetime | None = None
    # Number of uses of the invite
    uses: int | None = None
    # Maximum number of uses of the invite
    max_uses: int | None = None
