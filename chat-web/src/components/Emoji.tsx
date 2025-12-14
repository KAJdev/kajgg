import { getEmojiUrl } from "src/lib/cache";
import type { Emoji as EmojiType } from "src/types";

export function Emoji({
  emoji,
  className,
}: {
  emoji: EmojiType | string;
  className?: string;
}) {
  if (typeof emoji === "string") {
    return <span className={classes("w-4 h-4", className)}>{emoji}</span>;
  }
  return (
    <img
      src={getEmojiUrl(emoji.id)}
      alt={`:${emoji.name}:`}
      className={classes("w-4 h-4", className)}
      loading="lazy"
    />
  );
}
