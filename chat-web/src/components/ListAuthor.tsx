import type { Author as AuthorType } from "src/types";
import { Status } from "./Status";
import { Status as StatusType } from "src/types/models/status";

export function ListAuthor({ author }: { author: AuthorType }) {
  return (
    <div
      key={author.id}
      className={classes(
        author.status === StatusType.OFFLINE
          ? "text-neutral-500"
          : "text-neutral-300"
      )}
    >
      <Status status={author.status} />
      {author.username}
    </div>
  );
}
