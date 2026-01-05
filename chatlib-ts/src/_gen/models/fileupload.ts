import type { File } from "./file";

export type FileUpload = {
    /** The file metadata created server-side */
    file: File;
    /** Presigned URL for uploading the file (PUT) */
    upload_url: string;
    /** HTTP method to use for the upload */
    method: string;
}
