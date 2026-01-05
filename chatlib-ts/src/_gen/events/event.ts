import type { AuthorUpdated } from "./authorupdated";
import type { ChannelCreated } from "./channelcreated";
import type { ChannelDeleted } from "./channeldeleted";
import type { ChannelUpdated } from "./channelupdated";
import type { MessageCreated } from "./messagecreated";
import type { MessageDeleted } from "./messagedeleted";
import type { MessageUpdated } from "./messageupdated";
import type { TypingStarted } from "./typingstarted";

export type Event =
  { t: "AUTHOR_UPDATED"; d: AuthorUpdated }
  | { t: "CHANNEL_CREATED"; d: ChannelCreated }
  | { t: "CHANNEL_DELETED"; d: ChannelDeleted }
  | { t: "CHANNEL_UPDATED"; d: ChannelUpdated }
  | { t: "MESSAGE_CREATED"; d: MessageCreated }
  | { t: "MESSAGE_DELETED"; d: MessageDeleted }
  | { t: "MESSAGE_UPDATED"; d: MessageUpdated }
  | { t: "TYPING_STARTED"; d: TypingStarted }
;
