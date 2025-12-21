export type File = {
    /** Unique identifier for the file */
    id: string;
    /** Original filename */
    name: string;
    /** MIME type of the file */
    mime_type: string;
    /** File size in bytes */
    size: number;
    /** URL to access the file */
    url: string;
    /** Height of the file */
    height?: number;
    /** Width of the file */
    width?: number;
}
