import type { Author } from "./author";
import type { Status } from "./status";

export type User = Author & {
    /** Email address of the user */
    email: string;
    /** Token for the user */
    token?: string;
    /** Whether the user is verified */
    verified?: boolean;
    /** Default online status of the user */
    default_status?: Status;
}
