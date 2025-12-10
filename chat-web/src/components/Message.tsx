import { useAuthor } from "src/lib/cache";
import type { Message as MessageType } from "src/types/models/message";

const colors = [
  "bg-purple-300/80",
  "bg-blue-300/80",
  "bg-green-300/80",
  "bg-yellow-300/80",
  "bg-orange-300/80",
  "bg-red-300/80",
];

// Deterministically pick a color by hashing the author ID
function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + (str.codePointAt(i) ?? 0)) >>> 0;
  }
  return hash;
}

export function Message({
  message,
  previousMessage,
}: {
  readonly message: MessageType;
  readonly previousMessage: MessageType | null;
}) {
  const author = useAuthor(message.author_id);
  const timestamp = new Date(
    message.updated_at ?? message.created_at
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const color = colors[hashString(message.author_id || "none") % colors.length];

  // Time since previous message in milliseconds
  const timeSincePreviousMessage = previousMessage
    ? new Date(previousMessage.created_at).getTime() -
      new Date(message.created_at).getTime()
    : 0;

  return (
    <div className="flex flex-col gap-2 w-full items-start gap-2 py-[2px] text-emerald-100 group">
      {(previousMessage?.author_id !== message.author_id ||
        timeSincePreviousMessage > 1000 * 60 * 5) && (
        <div className="flex items-center gap-2 mt-4">
          <span className={classes(color, "font-black px-1 text-black")}>
            {author?.username ?? "anon"}
          </span>
          <span className="opacity-30">{timestamp}</span>
        </div>
      )}
      <span>
        <span className="flex-1 break-words opacity-80">{message.content}</span>
        {message.updated_at && (
          <span className="opacity-10 ml-2">(edited)</span>
        )}
      </span>
    </div>
  );
}
