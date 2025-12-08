import { Status } from "./status";

export type Author = {
    /** Unique identifier for the author */
    id: string;
    /** Display name of the author */
    username: string;
    /** URL to the author's avatar image */
    avatar_url: string;
    /** Biography or description of the author */
    bio: string;
    /** When the author was created */
    created_at: Date;
    /** When the author was last updated */
    updated_at: Date;
    /** Current online status of the author */
    status: Status;
}
