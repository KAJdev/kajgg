import type { Author } from "./author";

export type Channel = {
    /** Unique identifier for the channel */
    id: string;
    /** Display name of the channel */
    name: string;
    /** Channel topic or description */
    topic: string;
    /** When the channel was created */
    created_at: Date;
    /** When the channel was last updated */
    updated_at: Date;
    /** When the channel had its last message */
    last_message_at?: Date;
    /** ID of the user who created the channel */
    author_id: string;
    /** Whether the channel is private */
    private: boolean;
    author?: Author;
}
