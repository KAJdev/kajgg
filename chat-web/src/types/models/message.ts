import type { Author } from "./author";
import type { Channel } from "./channel";
import type { Embed } from "./embed";
import type { File } from "./file";
import type { MessageType } from "./messagetype";

export type Message = {
    /** Unique identifier for the message */
    id: string;
    /** Type of the message */
    type: MessageType;
    /** Text content of the message */
    content?: string;
    /** List of files attached to the message */
    files: File[];
    /** List of embeds attached to the message */
    embeds?: Embed[];
    /** When the message was created */
    created_at: Date;
    /** When the message was last updated */
    updated_at?: Date;
    /** ID of the user who sent the message */
    author_id: string;
    /** ID of the channel this message belongs to */
    channel_id: string;
    /** Nonce for the message */
    nonce?: string;
    author?: Author;
    channel?: Channel;
}
