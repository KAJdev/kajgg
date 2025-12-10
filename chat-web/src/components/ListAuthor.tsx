import type { Author as AuthorType } from "src/types";
import { Status } from "./Status";

export function ListAuthor({ author }: { author: AuthorType }) {
  return (
    <div key={author.id} className="text-neutral-300">
      <Status status={author.status} />
      {author.username}
    </div>
  );
}
