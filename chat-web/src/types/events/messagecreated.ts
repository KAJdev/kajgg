import type { Author } from "../models/author";
import type { Message } from "../models/message";

export type MessageCreated = {
    message: Message;
    author: Author;
}
