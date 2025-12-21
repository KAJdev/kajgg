from dataclasses import dataclass
from .file import File


@dataclass
class FileUpload:
    # The file metadata created server-side
    file: File | None = None
    # Presigned URL for uploading the file (PUT)
    upload_url: str | None = None
    # HTTP method to use for the upload
    method: str | None = None
