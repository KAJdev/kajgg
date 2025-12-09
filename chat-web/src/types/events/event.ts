import { EventType } from "./eventtype";
import { AuthorUpdated } from "./authorupdated";
import { ChannelCreated } from "./channelcreated";
import { MessageCreated } from "./messagecreated";
import { MessageDeleted } from "./messagedeleted";
import { MessageUpdated } from "./messageupdated";

export type Event =
  { t: EventType.AUTHOR_UPDATED; d: AuthorUpdated }
  | { t: EventType.CHANNEL_CREATED; d: ChannelCreated }
  | { t: EventType.MESSAGE_CREATED; d: MessageCreated }
  | { t: EventType.MESSAGE_DELETED; d: MessageDeleted }
  | { t: EventType.MESSAGE_UPDATED; d: MessageUpdated }
;
