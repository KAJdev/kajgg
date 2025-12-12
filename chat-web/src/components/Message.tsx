import { useAuthor, type CachedMessage } from "src/lib/cache";
import { ChatInput } from "./ChatInput";
import { deleteMessage, editMessage } from "src/lib/api";
import { MessageType as MessageTypeEnum } from "@schemas/index";
import { hashString } from "src/lib/utils";
import { Username } from "./Username";
import type { File as ApiFile } from "@schemas/models/file";

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

function getRandomMessage(messages: string[], authorId: string) {
  return messages[hashString(authorId) % messages.length];
}

export type MessageProps = {
  readonly message: CachedMessage;
  readonly previousMessage: CachedMessage | null;
  readonly editing?: boolean;
  readonly onCancelEdit: () => void;
};

function MessageFile({
  file,
  progress,
  previewUrl,
}: {
  file: ApiFile;
  /** 0..1 */
  progress?: number;
  /** local preview url while uploading */
  previewUrl?: string;
}) {
  const showProgress =
    typeof progress === "number" &&
    progress >= 0 &&
    progress < 1 &&
    (file.mime_type.startsWith("image/") ||
      file.mime_type.startsWith("video/"));

  const hasPreview = !!previewUrl && previewUrl !== file.url;
  const previewSrc = previewUrl ?? file.url;
  const remoteSrc = file.url;
  const [remoteLoaded, setRemoteLoaded] = useState(() => !hasPreview);

  if (file.mime_type.startsWith("image/")) {
    return (
      <div className="flex flex-col gap-1">
        <a href={file.url} target="_blank" rel="noreferrer" className="block">
          <div
            className="max-h-72 max-w-88 border border-neutral-800 bg-black/10"
            style={
              hasPreview && !remoteLoaded
                ? {
                    backgroundImage: `url(${previewSrc})`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    backgroundSize: "contain",
                  }
                : undefined
            }
          >
            <img
              src={remoteSrc}
              alt={file.name}
              onLoad={() => setRemoteLoaded(true)}
              className={classes(
                "max-h-72 max-w-88 transition-opacity",
                hasPreview && !remoteLoaded ? "opacity-0" : "opacity-100"
              )}
            />
          </div>
        </a>
        {showProgress && (
          <div className="h-1 w-full max-w-88 bg-neutral-800">
            <div
              className="h-1 bg-emerald-400 transition-[width]"
              style={{ width: `${Math.floor(progress * 100)}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  if (file.mime_type.startsWith("video/")) {
    return (
      <div className="flex flex-col gap-1">
        <video
          src={showProgress && previewUrl ? previewSrc : remoteSrc}
          controls
          className="max-h-72 max-w-88 border border-neutral-800"
        />
        {showProgress && (
          <div className="h-1 w-full max-w-88 bg-neutral-800">
            <div
              className="h-1 bg-emerald-400 transition-[width]"
              style={{ width: `${Math.floor(progress * 100)}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  if (file.mime_type.startsWith("audio/")) {
    return (
      <audio
        src={file.url}
        controls
        className="max-w-88 border border-neutral-800"
      />
    );
  }

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      className="border border-neutral-800 px-2 py-1 text-neutral-200 hover:underline max-w-88 overflow-hidden text-ellipsis whitespace-nowrap"
    >
      {file.name}
    </a>
  );
}

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

  const isSending = message.client?.status === "sending";
  const isFailed = message.client?.status === "failed";

  return (
    <div
      className={classes(
        "flex flex-col w-full items-start gap-2 py-[2px] text-emerald-100",
        isSending && "opacity-50",
        isFailed && "opacity-70 text-red-400"
      )}
    >
      {showAuthorName && (
        <div className="flex items-center gap-2 mt-4">
          <Username
            id={message.author_id}
            username={author?.username ?? "anon"}
          />
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
        <>
          {message.content && (
            <span>
              <span className="flex-1 wrap-break-word whitespace-pre-wrap opacity-80">
                {message.content}
              </span>
              {message.updated_at && (
                <span className="opacity-10 ml-2">(edited)</span>
              )}
            </span>
          )}
        </>
      )}
      {message.files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.files.map((f) => (
            <MessageFile
              key={f.id}
              file={f}
              progress={message.client?.uploads?.[f.id]?.progress}
              previewUrl={message.client?.uploads?.[f.id]?.preview_url}
            />
          ))}
        </div>
      )}

      {isFailed && (
        <div className="text-xs text-red-400/90">
          failed to send
          {message.client?.error ? `: ${message.client.error}` : ""}
        </div>
      )}
    </div>
  );
}

function JoinLeaveMessage({ message }: MessageProps) {
  const author = useAuthor(message.author_id);

  const supplementaryMessage = getRandomMessage(
    message.type === MessageTypeEnum.JOIN ? joinMessages : leaveMessages,
    message.id
  );

  return (
    <div className="flex w-full items-center gap-2 mt-4 py-2 text-emerald-100">
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
      <Username id={message.author_id} username={author?.username ?? "anon"} />{" "}
      {supplementaryMessage}
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
