import { Author } from "../models/author";
import { Channel } from "../models/channel";
import { Message } from "../models/message";

export type MessageCreated = {
    message: Message;
    channel: Channel;
    author: Author;
}
