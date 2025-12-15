import { getColor } from "src/lib/utils";
import { Popover } from "react-tiny-popover";
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
  const [isOpen, setIsOpen] = useState(false);
  if (!author) {
    return null;
  }

  const content = (
    <span
      onClick={() => allowPlate && setIsOpen(true)}
      className={classes(
        "overflow-hidden text-ellipsis whitespace-nowrap min-w-0",
        isOpen && "bg-tertiary",
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
    return (
      <Popover
        onClickOutside={() => setIsOpen(false)}
        content={<AuthorPlate author={author} />}
        positions={["left", "right"]}
        isOpen={isOpen}
        align="start"
        padding={10}
      >
        {content}
      </Popover>
    );
  }

  return content;
}
