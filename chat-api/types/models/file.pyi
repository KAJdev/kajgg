from dataclasses import dataclass


@dataclass
class File:
    # Unique identifier for the file
    id: str
    # Original filename
    name: str
    # MIME type of the file
    mime_type: str
    # File size in bytes
    size: int
    # URL to access the file
    url: str
