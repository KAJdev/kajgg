from dataclasses import dataclass
from ..models.author import Author
from ..models.message import Message


@dataclass
class MessageCreated:
    message: Message | None = None
    author: Author | None = None
