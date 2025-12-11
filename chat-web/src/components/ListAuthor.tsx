import type { Author as AuthorType } from "src/types";
import { Status } from "./Status";
import { Status as StatusType } from "src/types/models/status";
import { Username } from "./Username";

export function ListAuthor({ author }: { author: AuthorType }) {
  return (
    <div
      key={author.id}
      className={classes(
        "flex items-center gap-1",
        author.status === StatusType.OFFLINE && "opacity-75"
      )}
    >
      <Status status={author.status} />
      <Username
        id={author.id}
        username={author.username}
        noColor={author.status !== StatusType.ONLINE}
      />
    </div>
  );
}
