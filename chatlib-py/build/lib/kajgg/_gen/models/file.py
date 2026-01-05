from dataclasses import dataclass


@dataclass
class File:
    # Unique identifier for the file
    id: str | None = None
    # Original filename
    name: str | None = None
    # MIME type of the file
    mime_type: str | None = None
    # File size in bytes
    size: int | None = None
    # URL to access the file
    url: str | None = None
    # Height of the file
    height: int | None = None
    # Width of the file
    width: int | None = None
