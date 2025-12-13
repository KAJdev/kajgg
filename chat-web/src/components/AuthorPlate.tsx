import type { Author } from "@schemas/models/author";
import { ListAuthor } from "./ListAuthor";

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

export function AuthorPlate({ author }: { author: Author }) {
  return (
    <div
      className="border border-tertiary p-2 w-[23rem] h-fit"
      style={{ backgroundColor: author.background_color + "50" }}
    >
      <div className="flex flex-col gap-2">
        <ListAuthor author={author} />
        <span className="text-secondary/60">
          {formatBytes(author.bytes ?? 0)}
        </span>
        <p className="text-secondary w-full whitespace-pre-wrap break-words">
          {author.bio?.slice(0, 1000)}
          {author.bio && author.bio.length > 1000 && "..."}
        </p>
      </div>
    </div>
  );
}
