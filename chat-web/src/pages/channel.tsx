import { useParams } from "react-router";
import { ChatInput } from "src/components/ChatInput";
import { ListAuthor } from "src/components/ListAuthor";
import { MessageList } from "src/components/MessageList";
import { TypingIndicator } from "src/components/TypingIndicator";
import { User } from "src/components/User";
import { Status as StatusType } from "src/types/models/status";
import { createMessage, fetchMessages } from "src/lib/api";
import {
  cache,
  setLastSeenChannel,
  setLastSeenChannelAt,
  useAuthors,
  useChannel,
  useChannelMessages,
  useChannels,
} from "src/lib/cache";
import { useKeybind } from "src/lib/keybind";
import { MessageType, type Author } from "@schemas/index";
import type { Attachment } from "src/components/ChatInput";
import { ListChannel } from "src/components/ListChannel";
import { Label } from "@theme/Label";

const statusOrder = [
  StatusType.ONLINE,
  StatusType.AWAY,
  StatusType.DO_NOT_DISTURB,
  StatusType.OFFLINE,
];

export function Channel() {
  const { channelId = "" } = useParams();
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const messageMap = useChannelMessages(channelId);
  const channel = useChannel(channelId);
  const channels = useChannels();
  const authors = useAuthors();

  function afterSubmit() {
    setEditingMessageId(null);
    setContent("");
    setAttachments([]);
  }

  function handleSubmit() {
    const newContent = content.trim();
    if (newContent.length === 0 && attachments.length === 0) {
      return;
    }

    const files = attachments.map((a) => a.file);
    afterSubmit();
    return createMessage(channelId, newContent, files);
  }

  useEffect(() => {
    if (channelId) {
      setLastSeenChannel(channelId);
      // initial page: load latest messages (server defaults to 50, but we make it explicit)
      void fetchMessages(channelId, undefined, undefined, 50);
    }

    return () => {
      if (channelId) {
        setLastSeenChannelAt(channelId, Date.now());
      }
    };
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;

    const markSeen = () => setLastSeenChannelAt(channelId, Date.now());

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

  const messages = useMemo(() => {
    return Object.values(messageMap ?? {}).sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messageMap]);

  const channelList = useMemo(
    () =>
      Object.values(channels ?? {}).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [channels]
  );

  const authorList: Record<StatusType, Author[]> = useMemo(() => {
    return Object.values(authors ?? {}).reduce((acc, author) => {
      acc[author.status as StatusType] = [
        ...(acc[author.status as StatusType] ?? []),
        author,
      ];
      return acc;
    }, {} as Record<StatusType, Author[]>);
  }, [authors]);

  useKeybind("arrowup", () => {
    if (editingMessageId) {
      return;
    }

    const user = cache.getState().user;

    if (!user) {
      return;
    }

    // find the last message that is not sending, that you sent, that is a default type
    const lastMessage = messages
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

    if (lastMessage) {
      setEditingMessageId(lastMessage.id);
    }
  });

  useKeybind("escape", () => {
    if (editingMessageId) {
      setEditingMessageId(null);
    }
  });

  return (
    <div className="grid h-full min-h-0 w-full grid-cols-1 gap-3 md:grid-cols-[18ch_1fr_18ch]">
      <div className="flex-col gap-2 overflow-hidden p-3 hidden md:flex">
        <Label>channels</Label>
        <div className="flex-1 flex-col">
          {channelList.length ? (
            channelList.map((ch) => {
              const active = ch.id === channelId;
              return <ListChannel key={ch.id} channel={ch} active={active} />;
            })
          ) : (
            <div className="text-tertiary">no channels</div>
          )}
        </div>
        <User />
      </div>

      <div className="grid h-full grid-rows-[auto_1fr_auto] p-3 min-h-0">
        <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-tertiary">
          <span className="text-primary">{`#${
            channel?.name ?? "loading"
          }`}</span>
          <span className="truncate text-secondary">
            {channel?.topic || "no topic yet"}
          </span>
          <span className="text-tertiary">{channelId ?? "--"}</span>
        </div>

        <div className="flex flex-col gap-2 min-h-0">
          <MessageList
            channelId={channelId}
            messages={messages}
            editingMessageId={editingMessageId}
            setEditingMessageId={setEditingMessageId}
          />
        </div>

        <TypingIndicator channelId={channelId} />

        <ChatInput
          content={content}
          attachments={attachments}
          setAttachments={setAttachments}
          setContent={setContent}
          onSubmit={handleSubmit}
          placeholder={`> message #${channel?.name ?? ""}`}
          autofocus={!editingMessageId}
        />
      </div>

      <div className="flex-col gap-6 overflow-hidden p-3 overflow-y-auto min-h-0 hidden md:flex">
        {Object.entries(authorList)
          .sort(
            (a, b) =>
              statusOrder.indexOf(a[0] as StatusType) -
              statusOrder.indexOf(b[0] as StatusType)
          )
          .map(([status, authors]) => (
            <div key={status} className="flex flex-col gap-2">
              <Label className="flex items-center gap-2 justify-between">
                {status}{" "}
                <span className="text-secondary/60">{authors.length}</span>
              </Label>
              <div className="flex flex-col">
                {authors.map((author) => (
                  <ListAuthor key={author.id} author={author} />
                ))}
              </div>
            </div>
          ))}

        {Object.keys(authorList).length === 0 && (
          <div className="text-tertiary">no authors</div>
        )}
      </div>
    </div>
  );
}
