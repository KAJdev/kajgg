import type { Author } from "@schemas/models/author";
import { ListAuthor } from "./ListAuthor";
import { useFlippedColors } from "src/lib/cache";
import { MessageMarkdown } from "./MessageMarkdown";
import { Popover } from "react-tiny-popover";

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} Bytes`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} Kilobytes`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} Megabytes`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} Gigabytes`;
}

export function AuthorPlate({
  author,
  children,
}: {
  author: Author;
  children?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const colors = useFlippedColors(author.background_color ?? "#101010");

  const content = (
    <div className="border border-tertiary bg-background w-[18rem] h-fit">
      <div
        className={classes("flex flex-col gap-2 p-2")}
        style={{ backgroundColor: author.background_color }}
      >
        <ListAuthor author={author} allowPlate={false} />
        <span className="opacity-60" style={{ color: colors.secondary }}>
          {formatBytes(author.bytes ?? 0)}
        </span>
        {author.bio && (
          <div
            className="w-full whitespace-pre-wrap break-words"
            style={{ color: colors.secondary }}
          >
            <MessageMarkdown
              content={
                (author.bio?.slice(0, 1000) ?? "") +
                (author.bio?.length > 1000 ? "..." : "")
              }
            />
          </div>
        )}
      </div>
    </div>
  );

  if (children) {
    return (
      <Popover
        onClickOutside={() => setIsOpen(false)}
        content={content}
        positions={["left", "right"]}
        isOpen={isOpen}
        align="start"
        padding={10}
      >
        <div
          className={classes(
            "cursor-pointer hover:bg-tertiary",
            isOpen && "bg-tertiary"
          )}
          onClick={() => setIsOpen(true)}
        >
          {children}
        </div>
      </Popover>
    );
  }

  return content;
}
