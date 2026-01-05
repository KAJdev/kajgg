from dataclasses import dataclass


@dataclass
class Emoji:
    # Unique identifier for the emoji
    id: str | None = None
    # Name of the emoji
    name: str | None = None
    # Whether the emoji is animated
    animated: bool | None = None
    # MIME type of the emoji image
    mime_type: str | None = None
    # File extension for the emoji image (e.g. png, gif, webp)
    ext: str | None = None
