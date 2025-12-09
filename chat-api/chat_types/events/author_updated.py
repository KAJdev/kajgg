from dataclasses import dataclass
from ..models.author import Author


@dataclass
class AuthorUpdated:
    author: Author | None = None
