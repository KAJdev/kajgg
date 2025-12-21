from dataclasses import dataclass
from datetime import datetime


@dataclass
class Webhook:
    # Unique identifier for the webhook
    id: str | None = None
    # ID of the user who created the webhook
    owner_id: str | None = None
    # Name of the webhook
    name: str | None = None
    # Color of the webhook
    color: str | None = None
    # ID of the channel this webhook belongs to
    channel_id: str | None = None
    # When the webhook was created
    created_at: datetime | None = None
    # When the webhook was last updated
    updated_at: datetime | None = None
    # Secret for the webhook
    secret: str | None = None
