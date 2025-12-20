import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router";
import { ChatInput, type Attachment } from "src/components/ChatInput";
import { ListAuthor } from "src/components/ListAuthor";
import { MessageList } from "src/components/MessageList";
import { TypingIndicator } from "src/components/TypingIndicator";
import { User } from "src/components/User";
import { Status as StatusType } from "src/types/models/status";
import { createMessage, fetchMessages } from "src/lib/api";
import {
  cache,
  setLastSeenChannel,
  markChannelAsRead,
  useAuthors,
  useChannel,
  useChannels,
} from "src/lib/cache";
import { useKeybind } from "src/lib/keybind";
import { MessageType, type Author } from "@schemas/index";
import { ListChannel } from "src/components/ListChannel";
import { Label } from "@theme/Label";
import { Button } from "@theme/Button";
import { PlusIcon } from "lucide-react";
import { CreateChannel } from "src/components/CreateChannel";
import { Modal } from "@theme/Modal";
import { EmojiSearch } from "src/components/EmojiSearch";
import { MentionSearch } from "src/components/MentionSearch";
import { ChannelSearch } from "src/components/ChannelSearch";
import { EditChannel } from "src/components/EditChannel";
import { router } from "src/routes";

const statusOrder = [
  StatusType.ONLINE,
  StatusType.AWAY,
  StatusType.DO_NOT_DISTURB,
  StatusType.OFFLINE,
];

type ChannelComposerHandle = {
  appendQuote: (quotedMessage: string) => void;
  isPickerOpen: () => boolean;
  hasDraft: () => boolean;
};

const ChannelHeader = memo(function ChannelHeader({
  channelId,
}: Readonly<{
  channelId: string;
}>) {
  const channel = useChannel(channelId);
  return (
    <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-tertiary">
      <span className="text-primary">{`#${channel?.name ?? "loading"}`}</span>
      <span className="truncate text-secondary">
        {channel?.topic || "no topic yet"}
      </span>
      <span className="text-tertiary">{channelId ?? "--"}</span>
    </div>
  );
});

const ChannelSidebar = memo(function ChannelSidebar({
  channelId,
  onOpenCreate,
}: Readonly<{
  channelId: string;
  onOpenCreate: () => void;
}>) {
  const channels = useChannels();
  const channelList = useMemo(
    () =>
      Object.values(channels ?? {}).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [channels]
  );

  return (
    <div className="flex-col gap-2 overflow-hidden p-3 hidden md:flex">
      <div className="flex items-center gap-2 justify-between">
        <Label>channels</Label>
        <Button icon={PlusIcon} onClick={onOpenCreate} />
      </div>
      <div className="flex-1 flex-col">
        {channelList.length ? (
          channelList.map((ch) => (
            <ListChannel
              key={ch.id}
              channel={ch}
              active={ch.id === channelId}
            />
          ))
        ) : (
          <div className="text-tertiary">no channels</div>
        )}
      </div>
      <User />
    </div>
  );
});

const AuthorSidebar = memo(function AuthorSidebar() {
  const authors = useAuthors();
  const authorList: Record<StatusType, Author[]> = useMemo(() => {
    return Object.values(authors ?? {}).reduce((acc, author) => {
      acc[author.status as StatusType] = [
        ...(acc[author.status as StatusType] ?? []),
        author,
      ];
      return acc;
    }, {} as Record<StatusType, Author[]>);
  }, [authors]);

  const ordered = useMemo(() => {
    return Object.entries(authorList).sort(
      (a, b) =>
        statusOrder.indexOf(a[0] as StatusType) -
        statusOrder.indexOf(b[0] as StatusType)
    );
  }, [authorList]);

  return (
    <div className="flex-col gap-6 overflow-hidden p-3 overflow-y-auto min-h-0 hidden md:flex">
      {ordered.map(([status, list]) => (
        <div key={status} className="flex flex-col gap-2">
          <Label className="flex items-center gap-2 justify-between">
            {status} <span className="text-secondary/60">{list.length}</span>
          </Label>
          <div className="flex flex-col">
            {list.map((author) => (
              <ListAuthor key={author.id} author={author} allowPlate />
            ))}
          </div>
        </div>
      ))}

      {Object.keys(authorList).length === 0 && (
        <div className="text-tertiary">no authors</div>
      )}
    </div>
  );
});

const ChannelComposerImpl = memo(
  forwardRef<
    ChannelComposerHandle,
    Readonly<{
      channelId: string;
      channelName: string | undefined;
      autofocus: boolean;
      editingMessageId: string | null;
    }>
  >(function ChannelComposerImpl(
    {
      channelId,
      channelName,
      autofocus,
    }: Readonly<{
      channelId: string;
      channelName: string | undefined;
      autofocus: boolean;
      editingMessageId: string | null;
    }>,
    ref
  ) {
    const channel = useChannel(channelId);
    const resolvedChannelName = channel?.name ?? channelName;
    const [content, setContent] = useState("");
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const emojiQuery = useMemo(() => {
      // ends with : followed by at least 2 alphabetic characters (e.g. 'soemthing :aa', 'something :AA', 'something :aA', 'something :AAa')
      const isTypingEmoji =
        content.length >= 3 && /:[a-zA-Z]{2,}$/.test(content);
      return isTypingEmoji ? content.split(":").at(-1) : null;
    }, [content]);

    const mentionQuery = useMemo(() => {
      // ends with @ followed by up to 32 valid username characters, and either start-of-string or whitespace before the @
      const m =
        content.length > 0
          ? content.match(/(?:^|\s)@([a-zA-Z0-9_-]{0,32})$/)
          : null;
      return m ? m[1] : null;
    }, [content]);

    const channelQuery = useMemo(() => {
      // ends with # followed by up to 64 valid channel characters, and either start-of-string or whitespace before the #
      const m =
        content.length > 0
          ? content.match(/(?:^|\s)#([a-zA-Z0-9_-]{0,64})$/)
          : null;
      return m ? m[1] : null;
    }, [content]);

    const pickerOpen = !!(emojiQuery || mentionQuery || channelQuery);
    const hasDraft = content.trim().length > 0 || attachments.length > 0;

    const appendQuote = useCallback((quotedMessage: string) => {
      setContent((prev) => {
        const quoted = `${quotedMessage
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n")}\n\n`;
        return `${quoted}${prev ?? ""}`;
      });

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        appendQuote,
        isPickerOpen: () => pickerOpen,
        hasDraft: () => hasDraft,
      }),
      [appendQuote, pickerOpen, hasDraft]
    );

    const handleSubmit = useCallback(() => {
      const newContent = content.trim();
      if (newContent.length === 0 && attachments.length === 0) {
        return;
      }

      const files = attachments.map((a) => a.file);
      setContent("");
      setAttachments([]);
      return createMessage(channelId, newContent, files);
    }, [attachments, channelId, content]);

    return (
      <div className="flex flex-col relative">
        <ChannelSearch
          query={channelQuery}
          onPick={(ch) => {
            const escaped = channelQuery?.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            );
            setContent((prev) =>
              prev.replace(new RegExp(`#${escaped}$`), `#${ch.name} `)
            );
          }}
        />

        <MentionSearch
          query={mentionQuery}
          onPick={(author) => {
            const escaped = mentionQuery?.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            );
            setContent((prev) =>
              prev.replace(new RegExp(`@${escaped}$`), `@${author.username} `)
            );
          }}
        />

        {emojiQuery && (
          <EmojiSearch
            query={emojiQuery}
            onPick={(emoji) => {
              const stripped = content.split(":").slice(0, -1).join(":");
              setContent(`${stripped}${emoji}`);
            }}
          />
        )}

        <TypingIndicator channelId={channelId} />

        <ChatInput
          content={content}
          attachments={attachments}
          setAttachments={setAttachments}
          setContent={setContent}
          onSubmit={handleSubmit}
          placeholder={`> message #${resolvedChannelName ?? ""}`}
          autofocus={autofocus}
          emojiQuery={emojiQuery}
          mentionQuery={mentionQuery}
          channelQuery={channelQuery}
          textareaRef={textareaRef}
        />
      </div>
    );
  })
);

export function Channel() {
  const { channelId = "" } = useParams();
  const navigate = useNavigate();

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const composerRef = useRef<ChannelComposerHandle>(null);
  const openCreateChannel = useCallback(() => setCreateChannelOpen(true), []);

  const onQuote = useCallback((quotedMessage: string) => {
    composerRef.current?.appendQuote(quotedMessage);
  }, []);

  useEffect(() => {
    if (channelId) {
      setLastSeenChannel(channelId);
      markChannelAsRead(channelId);
      void fetchMessages(channelId, undefined, undefined, 100);
    }
  }, [channelId]);

  useEffect(() => {
    if (channelId) return;

    const channelIds = Object.keys(cache.getState().channels ?? {});

    if (channelIds.length > 0) {
      router.navigate(`/channels/${channelIds[0]}`);
    }
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;

    const markSeen = () => markChannelAsRead(channelId);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        markSeen();
      }
    };

    window.addEventListener("pagehide", markSeen);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pagehide", markSeen);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [channelId]);

  useKeybind("arrowup", () => {
    if (editingMessageId) {
      return;
    }

    if (
      composerRef.current?.isPickerOpen() ||
      composerRef.current?.hasDraft()
    ) {
      return;
    }

    const user = cache.getState().user;

    if (!user) {
      return;
    }

    // idk the best way to do this without subscribing the whole page to messages,
    // so we just read from the store directly here.
    const channelMsgs = cache.getState().messages[channelId] ?? {};
    const lastMessage = Object.values(channelMsgs)
      .filter((message) => {
        return (
          message.client?.status !== "sending" &&
          message.author_id === user.id &&
          message.type === MessageType.DEFAULT
        );
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .at(0);

    if (lastMessage) setEditingMessageId(lastMessage.id);
  });

  useKeybind("escape", () => {
    if (editingMessageId) {
      setEditingMessageId(null);
    }
  });

  return (
    <>
      <div className="grid h-full min-h-0 w-full grid-cols-1 gap-3 md:grid-cols-[26ch_1fr_26ch]">
        <ChannelSidebar
          channelId={channelId}
          onOpenCreate={openCreateChannel}
        />

        <div className="grid h-full grid-rows-[auto_1fr_auto] p-3 min-h-0">
          <ChannelHeader channelId={channelId} />

          <div className="flex flex-col gap-2 min-h-0">
            <MessageList
              key={channelId}
              channelId={channelId}
              editingMessageId={editingMessageId}
              setEditingMessageId={setEditingMessageId}
              onQuote={onQuote}
            />
          </div>

          <ChannelComposerImpl
            ref={composerRef}
            channelId={channelId}
            channelName={undefined}
            autofocus={!editingMessageId}
            editingMessageId={editingMessageId}
          />
        </div>

        <AuthorSidebar />
      </div>

      <Modal
        title="Create Channel"
        className="sm:max-w-lg"
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
      >
        <CreateChannel
          onCreated={(channel) => {
            setCreateChannelOpen(false);
            navigate(`/channels/${channel.id}`);
          }}
        />
      </Modal>

      <EditChannel />
    </>
  );
}
