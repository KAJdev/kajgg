import { getColor } from "src/lib/utils";
import type { Author } from "@schemas/models/author";
import { AuthorPlate } from "./AuthorPlate";

export function Username({
  author,
  noColor,
  allowPlate = true,
  noHover = false,
}: {
  author: Author;
  noColor?: boolean;
  allowPlate?: boolean;
  noHover?: boolean;
}) {
  const content = (
    <span
      className={classes(
        "overflow-hidden text-ellipsis whitespace-nowrap min-w-0",
        allowPlate && !noHover && "hover:bg-tertiary cursor-pointer"
      )}
      style={{
        color: noColor ? undefined : author.color ?? getColor(author.id),
        fontWeight: noColor ? "normal" : "bold",
      }}
    >
      {author.username}
    </span>
  );

  if (allowPlate) {
    return <AuthorPlate author={author}>{content}</AuthorPlate>;
  }

  return content;
}
