import type { Author } from "../models/author";
import type { Channel } from "../models/channel";
import type { Message } from "../models/message";

export type MessageCreated = {
    message: Message;
    channel: Channel;
    author: Author;
}
