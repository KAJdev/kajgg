export type Emoji = {
    /** Unique identifier for the emoji */
    id: string;
    /** Name of the emoji */
    name: string;
    /** Whether the emoji is animated */
    animated: boolean;
    /** MIME type of the emoji image */
    mime_type: string;
    /** File extension for the emoji image (e.g. png, gif, webp) */
    ext: string;
}
