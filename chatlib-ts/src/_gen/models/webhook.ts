export type Webhook = {
    /** Unique identifier for the webhook */
    id: string;
    /** ID of the user who created the webhook */
    owner_id: string;
    /** Name of the webhook */
    name: string;
    /** Color of the webhook */
    color: string;
    /** ID of the channel this webhook belongs to */
    channel_id: string;
    /** When the webhook was created */
    created_at: Date;
    /** When the webhook was last updated */
    updated_at: Date;
    /** Secret for the webhook */
    secret: string;
}
