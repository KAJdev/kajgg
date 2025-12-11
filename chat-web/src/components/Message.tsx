import { useAuthor } from "src/lib/cache";
import type { Message as MessageType } from "src/types/models/message";
import { ChatInput } from "./ChatInput";
import { deleteMessage, editMessage } from "src/lib/api";
import { MessageType as MessageTypeEnum } from "@schemas/index";

const colors = [
  "#d8b4fecc", // bg-purple-300/80
  "#c084fccc", // bg-purple-400/80
  "#a21cafcc", // bg-purple-500/80
  "#e9d5ffcc", // bg-violet-300/80
  "#c7d2fecc", // bg-violet-400/80
  "#a5b4facc", // bg-indigo-300/80
  "#818cf8cc", // bg-indigo-400/80
  "#93c5fdcc", // bg-blue-300/80
  "#60a5facc", // bg-blue-400/80
  "#7dd3fcc", // bg-sky-300/80
  "#38bdf8cc", // bg-sky-400/80
  "#67e8f9cc", // bg-cyan-300/80
  "#22d3e6cc", // bg-cyan-400/80
  "#5eead4cc", // bg-teal-300/80
  "#2dd4bffc", // bg-teal-400/80
  "#86efacca", // bg-green-300/80
  "#4ade80cc", // bg-green-400/80
  "#bef264cc", // bg-lime-300/80
  "#a3e635cc", // bg-lime-400/80
  "#fde047cc", // bg-yellow-300/80
  "#facc15cc", // bg-yellow-400/80
  "#fcd34dcc", // bg-amber-300/80
  "#fbbf24cc", // bg-amber-400/80
  "#fdba74cc", // bg-orange-300/80
  "#fb923ccc", // bg-orange-400/80
  "#fca5a5cc", // bg-red-300/80
  "#f87171cc", // bg-red-400/80
  "#fda4afcc", // bg-rose-300/80
  "#fb7185cc", // bg-rose-400/80
  "#f9a8d4cc", // bg-pink-300/80
];

const leaveMessages = [
  "has dissapeared",
  "peaced out",
  "had better things to do",
  "got bored and left",
  "alt-f4'd",
  "got disconnected",
];

const joinMessages = [
  "has joined",
  "has entered",
  "has arrived",
  "has entered the chat",
  "has arrived in the chat",
];

// Deterministically pick a color by hashing the author ID
function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + (str.codePointAt(i) ?? 0)) >>> 0;
  }
  return hash;
}

function getColor(authorId: string) {
  return colors[hashString(authorId) % colors.length];
}

function getRandomMessage(messages: string[], authorId: string) {
  return messages[hashString(authorId) % messages.length];
}

export type MessageProps = {
  readonly message: MessageType;
  readonly previousMessage: MessageType | null;
  readonly editing?: boolean;
  readonly onCancelEdit: () => void;
};

function DefaultMessage({
  message,
  previousMessage,
  editing,
  onCancelEdit,
}: MessageProps) {
  const [content, setContent] = useState<string>(message.content ?? "");
  const author = useAuthor(message.author_id);
  const timestamp = new Date(
    message.updated_at ?? message.created_at
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const color = getColor(message.author_id);

  // Time since previous message in milliseconds
  const timeSincePreviousMessage = previousMessage
    ? new Date(message.created_at).getTime() -
      new Date(previousMessage.created_at).getTime()
    : 0;

  function handleSubmit() {
    if (editing) {
      if (content.trim().length === 0) {
        deleteMessage(message.channel_id, message.id);
      }

      editMessage(message.channel_id, message.id, content);

      onCancelEdit();
    }
  }

  const showAuthorName =
    !previousMessage ||
    previousMessage.author_id !== message.author_id ||
    previousMessage.type !== message.type ||
    timeSincePreviousMessage > 1000 * 60 * 5;

  return (
    <div className="flex flex-col w-full items-start gap-2 py-[2px] text-emerald-100">
      {showAuthorName && (
        <div className="flex items-center gap-2 mt-4">
          <span
            style={{ backgroundColor: color }}
            className={classes("font-black px-1 text-black")}
          >
            {author?.username ?? "anon"}
          </span>
          <span className="opacity-30">{timestamp}</span>
        </div>
      )}
      {editing ? (
        <div className="flex gap-2 flex-col w-full">
          <ChatInput
            content={content}
            setContent={setContent}
            onSubmit={handleSubmit}
            editing
            autofocus
          />
          <p>
            <button
              onClick={handleSubmit}
              className="text-blue-500 cursor-pointer hover:underline"
            >
              enter
            </button>{" "}
            to save -{" "}
            <button
              onClick={onCancelEdit}
              className="text-blue-500 cursor-pointer hover:underline"
            >
              escape
            </button>{" "}
            to cancel
          </p>
        </div>
      ) : (
        message.content && (
          <span>
            <span className="flex-1 break-words opacity-80">
              {message.content}
            </span>
            {message.updated_at && (
              <span className="opacity-10 ml-2">(edited)</span>
            )}
          </span>
        )
      )}
    </div>
  );
}

function JoinLeaveMessage({ message }: MessageProps) {
  const author = useAuthor(message.author_id);
  const color = getColor(message.author_id);

  const supplementaryMessage = getRandomMessage(
    message.type === MessageTypeEnum.JOIN ? joinMessages : leaveMessages,
    message.id
  );

  return (
    <div className="flex w-full items-center gap-2 py-4 text-emerald-100">
      <p className="text-neutral-500">
        {message.type === MessageTypeEnum.JOIN ? (
          <>
            [<span className="text-green-500">+</span>]
          </>
        ) : (
          <>
            [<span className="text-red-500">-</span>]
          </>
        )}
      </p>
      <span style={{ color }}>{author?.username}</span> {supplementaryMessage}
    </div>
  );
}

function UnknownMessage() {
  return (
    <div className="py-2 px-4 my-2 flex items-center border border-red-900/50 text-red-500">
      Update your client to view this message
    </div>
  );
}

export function Message(props: MessageProps) {
  switch (props.message.type) {
    case MessageTypeEnum.DEFAULT:
      return <DefaultMessage {...props} />;
    case MessageTypeEnum.JOIN:
      return <JoinLeaveMessage {...props} />;
    case MessageTypeEnum.LEAVE:
      return <JoinLeaveMessage {...props} />;
    default:
      return <UnknownMessage />;
  }
}
