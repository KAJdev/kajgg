from enum import Enum


class MessageType(Enum):
    DEFAULT = "default"
    JOIN = "join"
    LEAVE = "leave"
