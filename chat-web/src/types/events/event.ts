import { EventType } from "./eventtype";
import { ChannelCreated } from "./channelcreated";
import { MessageCreated } from "./messagecreated";
import { MessageUpdated } from "./messageupdated";

export type Event =
  { t: EventType.CHANNEL_CREATED; d: ChannelCreated }
  | { t: EventType.MESSAGE_CREATED; d: MessageCreated }
  | { t: EventType.MESSAGE_UPDATED; d: MessageUpdated }
;
