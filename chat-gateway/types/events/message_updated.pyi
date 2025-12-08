from dataclasses import dataclass
from ..models.message import Message


@dataclass
class MessageUpdated:
    message: Message
