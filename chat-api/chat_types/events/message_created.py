from dataclasses import dataclass
from ..models.author import Author
from ..models.channel import Channel
from ..models.message import Message


@dataclass
class MessageCreated:
    message: Message | None = None
    channel: Channel | None = None
    author: Author | None = None
