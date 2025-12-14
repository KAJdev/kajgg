import { getEmojiUrl } from "src/lib/cache";
import type { Emoji as EmojiType } from "src/types";

export function Emoji({ emoji }: { emoji: EmojiType | string }) {
  if (typeof emoji === "string") {
    return <span className="w-4 h-4">{emoji}</span>;
  }
  return (
    <img
      src={getEmojiUrl(emoji.id)}
      alt={`:${emoji.name}:`}
      className="w-4 h-4"
      loading="lazy"
    />
  );
}
