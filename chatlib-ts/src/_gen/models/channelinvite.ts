export type ChannelInvite = {
    /** Unique identifier for the invite */
    id: string;
    /** ID of the channel this invite belongs to */
    channel_id: string;
    /** ID of the user who created the invite */
    author_id: string;
    /** When the invite was created */
    created_at: Date;
    /** Code for the invite */
    code: string;
    /** When the invite expires */
    expires_at?: Date;
    /** Number of uses left for the invite */
    uses_left?: number;
}
