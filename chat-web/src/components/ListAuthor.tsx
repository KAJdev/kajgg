import type { Author as AuthorType } from "@schemas/models/author";
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
      <Username
        id={author.id}
        username={author.username}
        color={author.color}
        noColor={author.status === StatusType.OFFLINE}
      />
      <Status status={author.status} />
    </div>
  );
}
