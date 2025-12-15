import {
  setContextMenuState,
  useAuthor,
  useLastSeenChannelAt,
  useUser,
  type CachedMessage,
} from "src/lib/cache";
import { memo, useEffect, useState } from "react";
import { ChatInput } from "./ChatInput";
import { deleteMessage, editMessage } from "src/lib/api";
import { MessageType as MessageTypeEnum } from "@schemas/index";
import { getIsPageFocused, hashString } from "src/lib/utils";
import { Username } from "./Username";
import type { File as ApiFile } from "@schemas/models/file";
import { Modal } from "@theme/Modal";
import { Embed } from "./Embed";
import { MessageMarkdown } from "./MessageMarkdown";
import { motion } from "motion/react";
import { Button } from "@theme/Button";

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
  readonly onEdit: (id: string) => void;
  readonly onQuote: (content: string) => void;
};

export function MessageFile({
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
  const [open, setOpen] = useState(false);
  const [showRemote, setShowRemote] = useState(() => {
    // If there's no preview, we should just show the remote image
    return !previewUrl || previewUrl === file.url;
  });

  const showProgress =
    typeof progress === "number" &&
    progress >= 0 &&
    progress < 1 &&
    (file.mime_type.startsWith("image/") ||
      file.mime_type.startsWith("video/"));

  const hasPreview = !!previewUrl && previewUrl !== file.url;
  const previewSrc = previewUrl ?? file.url;
  const remoteSrc = file.url;

  // Instead of using <img> onLoad, use Image() preloading to seamlessly swap previews
  useEffect(() => {
    if (!hasPreview) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowRemote(true);
      return;
    }
    setShowRemote(false); // Start with preview shown, remote not shown
    const img = new Image();
    img.src = remoteSrc;
    img.onload = () => {
      setShowRemote(true);
    };
    // cleanup
    return () => {
      img.onload = null;
    };
  }, [remoteSrc, previewUrl, hasPreview]);

  // note: progress is 0..1; ui reads it from message.client.uploads

  if (file.mime_type.startsWith("image/")) {
    return (
      <div className="flex flex-col gap-1">
        <div
          className="max-h-72 max-w-88 cursor-pointer border border-tertiary bg-black/10 relative overflow-hidden"
          style={
            hasPreview && !showRemote
              ? {
                  backgroundImage: `url(${previewSrc})`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  backgroundSize: "contain",
                }
              : undefined
          }
          onClick={() => setOpen(true)}
        >
          <img
            src={showRemote ? remoteSrc : previewSrc}
            alt={file.name}
            className={classes(
              "max-h-72 max-w-88 transition-opacity object-cover select-none z-10"
            )}
            draggable={false}
          />

          {showProgress && (
            <motion.div
              className="bg-background/60 absolute top-0 left-0 w-full select-none pointer-events-none z-100"
              // scaley is way smoother than animating height percentages and doesn't trigger layout
              style={{ transformOrigin: "top" }}
              initial={{ scaleY: 1 }}
              transition={{
                duration: 100,
                ease: "linear",
              }}
              animate={{
                scaleY: 1 - progress,
              }}
            />
          )}
        </div>

        <Modal title={file.name} open={open} onClose={() => setOpen(false)}>
          <img src={remoteSrc} alt={file.name} />
          <div className="flex gap-2 items-center justify-between mt-4">
            {file.size ? (
              <p className="text-secondary/70">{file.size} bytes</p>
            ) : (
              <div />
            )}
            <p className="text-secondary/70">{file.mime_type}</p>
          </div>
        </Modal>
      </div>
    );
  }

  if (file.mime_type.startsWith("video/")) {
    return (
      <div className="flex flex-col gap-1">
        <video
          src={showProgress && previewUrl ? previewSrc : remoteSrc}
          controls
          className="max-h-72 max-w-88 border border-tertiary object-cover"
        />
        {showProgress && (
          <div className="h-1 w-full max-w-88 bg-tertiary">
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
      <audio src={file.url} controls className="w-88 border border-tertiary" />
    );
  }

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      className="border border-tertiary px-2 py-1 text-secondary hover:underline w-88 overflow-hidden text-ellipsis whitespace-nowrap"
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
  const cachedAuthor = useAuthor(message.author_id);
  const self = useUser();
  const author = message.author ??
    cachedAuthor ?? {
      id: message.author_id,
      username: "Unknown",
      created_at: new Date(),
      updated_at: new Date(),
    };
  const mentionedMe = !!self?.id && (message.mentions ?? []).includes(self.id);
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
    previousMessage.author?.username !== message.author?.username ||
    previousMessage.type !== message.type ||
    timeSincePreviousMessage > 1000 * 60 * 5;

  const isSending = message.client?.status === "sending";
  const isFailed = message.client?.status === "failed";

  return (
    <div
      className={classes(
        "flex flex-col w-full items-start gap-1",
        isSending && "opacity-50",
        isFailed && "opacity-70 text-red-400",
        mentionedMe && "bg-primary/10",
        showAuthorName && "mt-4",
        !editing && "hover:bg-tertiary/10"
      )}
    >
      {showAuthorName && (
        <div className="flex items-center gap-2">
          <Username author={author} />
          {author.flags?.webhook && (
            <span className="bg-tertiary px-1">webhook</span>
          )}
          <span className="opacity-30">{timestamp}</span>
        </div>
      )}
      {editing ? (
        <div className="flex gap-2 flex-col w-full py-1">
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
            <MessageMarkdown
              content={
                message.content + (message.updated_at ? ` *(edited)*` : "")
              }
              mentionIds={message.mentions}
            />
          )}
        </>
      )}
      {message.files && message.files.length > 0 && (
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

      {message.embeds && message.embeds.length > 0 && (
        <div className="flex flex-col flex-wrap gap-2">
          {message.embeds.map((e) => (
            <Embed embed={e} key={hashString(JSON.stringify(e))} />
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
  const cachedAuthor = useAuthor(message.author_id);
  const author = message.author ??
    cachedAuthor ?? {
      id: message.author_id,
      username: "Unknown",
      created_at: new Date(),
      updated_at: new Date(),
    };

  const supplementaryMessage = getRandomMessage(
    message.type === MessageTypeEnum.JOIN ? joinMessages : leaveMessages,
    message.id
  );

  return (
    <div className="flex w-full items-center gap-2 mt-4 py-2">
      <div className="text-tertiary">
        {message.type === MessageTypeEnum.JOIN ? (
          <>
            [<span className="text-green-500">+</span>]
          </>
        ) : (
          <>
            [<span className="text-red-500">-</span>]
          </>
        )}
      </div>
      <Username author={author} /> {supplementaryMessage}
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

export const MessageComponent = memo(
  function Message(props: MessageProps) {
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
  },
  (prev, next) =>
    prev.message === next.message &&
    prev.previousMessage === next.previousMessage &&
    prev.editing === next.editing
);

export function Message(props: MessageProps) {
  const channelLastSeenAt = useLastSeenChannelAt(props.message.channel_id);
  const pageFocused = getIsPageFocused();
  const self = useUser();

  const isOwnMessage = useMemo(() => {
    return props.message.author_id === self?.id;
  }, [props.message.author_id]);

  // we want to check the following
  // - lastSeenChannelAt is set
  // - message.created_at is after lastSeenChannelAt
  // - either there is no previous message or the previous message is before the message.created_at
  const isUnread =
    // if you're focused, nothing is "unread" in the active channel
    !pageFocused &&
    channelLastSeenAt &&
    new Date(channelLastSeenAt).getTime() <
      new Date(props.message.created_at).getTime() &&
    (!props.previousMessage ||
      new Date(props.previousMessage.created_at).getTime() <
        new Date(channelLastSeenAt).getTime());

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenuState(
          { x: e.clientX, y: e.clientY },
          <>
            {isOwnMessage && (
              <Button onClick={() => props.onEdit(props.message.id)}>
                Edit
              </Button>
            )}
            {isOwnMessage && (
              <Button
                onClick={() =>
                  deleteMessage(props.message.channel_id, props.message.id)
                }
              >
                Delete
              </Button>
            )}
            <Button onClick={() => props.onQuote(props.message.content ?? "")}>
              Quote
            </Button>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(props.message.content ?? "");
              }}
            >
              Copy Text
            </Button>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(props.message.id ?? "");
              }}
            >
              Copy ID
            </Button>
          </>
        );
      }}
    >
      {isUnread && (
        <div className="flex items-center gap-2 mt-4">
          <span className="text-red-500">! unread</span>
          <div className="h-px bg-red-500 w-full" />
        </div>
      )}
      <MessageComponent
        {...{
          ...props,
          // kinda a hack to force the author name to be shown
          previousMessage: isUnread ? null : props.previousMessage,
        }}
      />
    </div>
  );
}
