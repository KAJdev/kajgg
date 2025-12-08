import { File } from "./file";

export type Message = {
    /** Unique identifier for the message */
    id: string;
    /** Text content of the message */
    content: string;
    /** List of files attached to the message */
    files: File[];
    /** When the message was created */
    created_at: Date;
    /** When the message was last updated */
    updated_at: Date;
    /** ID of the user who sent the message */
    author_id: string;
    /** ID of the channel this message belongs to */
    channel_id: string;
}
