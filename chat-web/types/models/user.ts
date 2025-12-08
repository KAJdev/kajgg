import { Author } from "./author";

export type User = Author & {
    /** Email address of the user */
    email: string;
}
