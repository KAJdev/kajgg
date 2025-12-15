import type { Author as AuthorType } from "@schemas/models/author";
import { Status } from "./Status";
import { Status as StatusType } from "src/types/models/status";
import { Username } from "./Username";

export function ListAuthor({
  author,
  allowPlate,
}: {
  author: AuthorType;
  allowPlate?: boolean;
}) {
  return (
    <div
      key={author.id}
      className={classes(
        "flex items-center gap-1",
        author.status === StatusType.OFFLINE && "opacity-75"
      )}
    >
      <Username
        author={author}
        noColor={author.status === StatusType.OFFLINE}
        allowPlate={allowPlate}
      />
      {author.flags?.webhook ? (
        <span className="bg-tertiary px-1">webhook</span>
      ) : (
        <Status status={author.status} />
      )}
    </div>
  );
}
