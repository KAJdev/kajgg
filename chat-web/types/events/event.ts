import { EventType } from "./eventtype";
import { MessageCreated } from "./messagecreated";
import { MessageUpdated } from "./messageupdated";

export type Event =
  { t: EventType.MESSAGE_CREATED; d: MessageCreated }
  | { t: EventType.MESSAGE_UPDATED; d: MessageUpdated }
;
