import type { Author as AuthorType } from "@schemas/models/author";
import { Status } from "./Status";
import { Status as StatusType } from "src/types/models/status";
import { Username } from "./Username";
import { Avatar } from "./Avatar";
import { AuthorPlate } from "./AuthorPlate";

export function ListAuthor({
  author,
  allowPlate,
}: {
  author: AuthorType;
  allowPlate?: boolean;
}) {
  const content = (
    <div
      key={author.id}
      className={classes(
        "flex items-center gap-2",
        author.status === StatusType.OFFLINE && "opacity-75"
      )}
    >
      <Avatar
        id={author.id}
        username={author.username}
        avatarUrl={author.avatar_url}
        color={author.color}
        size={22}
      />
      <Username
        author={author}
        noColor={author.status === StatusType.OFFLINE}
        allowPlate={false}
      />
      {author.flags?.webhook ? (
        <span className="bg-tertiary px-1">webhook</span>
      ) : (
        <Status status={author.status} />
      )}
    </div>
  );

  if (allowPlate) {
    return <AuthorPlate author={author}>{content}</AuthorPlate>;
  }

  return content;
}
