from .event_type import EventType
from .author_updated import AuthorUpdated
from .channel_created import ChannelCreated
from .message_created import MessageCreated
from .message_deleted import MessageDeleted
from .message_updated import MessageUpdated
from .typing_started import TypingStarted


Event = {"t": EventType.AUTHOR_UPDATED, "d": AuthorUpdated} | {"t": EventType.CHANNEL_CREATED, "d": ChannelCreated} | {"t": EventType.MESSAGE_CREATED, "d": MessageCreated} | {"t": EventType.MESSAGE_DELETED, "d": MessageDeleted} | {"t": EventType.MESSAGE_UPDATED, "d": MessageUpdated} | {"t": EventType.TYPING_STARTED, "d": TypingStarted}
