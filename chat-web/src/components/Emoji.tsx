import Twemoji from "react-twemoji";
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
    return (
      <Twemoji tag="span" className={classes("w-5 h-5", className)}>
        {emoji}
      </Twemoji>
    );
  }
  return (
    <img
      src={getEmojiUrl(emoji.id)}
      alt={`:${emoji.name}:`}
      className={classes("w-5 h-5", className)}
      loading="lazy"
    />
  );
}
