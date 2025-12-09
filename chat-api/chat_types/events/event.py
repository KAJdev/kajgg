from .event_type import EventType
from .channel_created import ChannelCreated
from .message_created import MessageCreated
from .message_updated import MessageUpdated


Event = {"t": EventType.CHANNEL_CREATED, "d": ChannelCreated} | {"t": EventType.MESSAGE_CREATED, "d": MessageCreated} | {"t": EventType.MESSAGE_UPDATED, "d": MessageUpdated}
