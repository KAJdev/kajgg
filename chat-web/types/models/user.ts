import { Author } from "./author";

export type User = Author & {
    /** Email address of the user */
    email: string;
    /** Token for the user */
    token?: string;
    /** Whether the user is verified */
    verified?: boolean;
}
