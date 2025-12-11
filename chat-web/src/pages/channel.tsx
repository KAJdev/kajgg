import { Link, useParams } from "react-router";
import { ChatInput } from "src/components/ChatInput";
import { ListAuthor } from "src/components/ListAuthor";
import { Message } from "src/components/Message";
import { TypingIndicator } from "src/components/TypingIndicator";
import { User } from "src/components/User";
import { Page } from "src/layout/page";
import { createMessage, fetchMessages } from "src/lib/api";
import {
  useAuthors,
  useChannel,
  useChannelMessages,
  useChannels,
} from "src/lib/cache";
import { useKeybind } from "src/lib/keybind";

function Label({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="uppercase tracking-[0.08em] text-neutral-400/50">
      {children}
    </div>
  );
}

export function Channel() {
  const { channelId = "" } = useParams();
  const [content, setContent] = useState("");

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const messageMap = useChannelMessages(channelId);
  const channel = useChannel(channelId);
  const channels = useChannels();
  const authors = useAuthors();

  function afterSubmit() {
    setEditingMessageId(null);
    setContent("");
  }

  function handleSubmit() {
    const newContent = content.trim();
    if (newContent.length > 0) {
      return createMessage(channelId, newContent).then(afterSubmit);
    }
  }

  useEffect(() => {
    if (channelId) {
      fetchMessages(channelId);
    }
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

  const authorList = useMemo(
    () =>
      Object.values(authors ?? {}).sort((a, b) =>
        a.username.localeCompare(b.username)
      ),
    [authors]
  );

  useKeybind("arrowup", () => {
    if (editingMessageId) {
      return;
    }
    const lastMessage = messages.at(-1);
    if (lastMessage) {
      setEditingMessageId(lastMessage.id);
    }
  });

  useKeybind("escape", () => {
    if (editingMessageId) {
      setEditingMessageId(null);
    }
  });

  // we want tuples of messages like
  // [(null, 0), (0, 1), (1, 2), (2, null)]
  // where its [message, previousMessage]
  const tupledMessages = useMemo(() => {
    return messages.map((message, index) => {
      return [message, messages[index + 1]];
    });
  }, [messages]);

  return (
    <Page>
      <div className="grid h-full min-h-0 w-full grid-cols-1 gap-3 md:grid-cols-[18ch_1fr_18ch]">
        <div className="flex flex-col gap-2 overflow-hidden p-3">
          <Label>channels</Label>
          <div className="flex-1 overflow-y-auto flex-col">
            {channelList.length ? (
              channelList.map((ch) => {
                const active = ch.id === channelId;
                return (
                  <Link
                    key={ch.id}
                    className={classes(
                      "w-full text-left transition cursor-pointer flex items-center gap-2 whitespace-pre",
                      active
                        ? "text-neutral-200"
                        : "text-neutral-500 hover:text-neutral-200"
                    )}
                    to={`/channels/${ch.id}`}
                  >
                    <span>
                      {active ? "> " : "  "}#{ch.name}
                    </span>
                  </Link>
                );
              })
            ) : (
              <div className="text-neutral-600">no channels</div>
            )}
          </div>
          <User />
        </div>

        <div className="grid h-full grid-rows-[auto_1fr_auto] p-3 min-h-0">
          <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-neutral-800">
            <span className="text-neutral-200">{`#${
              channel?.name ?? "loading"
            }`}</span>
            <span className="truncate text-neutral-400/90">
              {channel?.topic || "no topic yet"}
            </span>
            <span className="text-neutral-500/30">{channelId ?? "--"}</span>
          </div>

          <div className="flex flex-col gap-2 min-h-0">
            <div className="flex-1 overflow-y-auto pr-1 min-h-0 flex flex-col-reverse pb-4">
              {messages?.length > 0 ? (
                tupledMessages
                  .slice()
                  .reverse()
                  .map(([message, previousMessage]) => (
                    <Message
                      key={message.id}
                      message={message}
                      previousMessage={previousMessage ?? null}
                      editing={editingMessageId === message?.id}
                      onCancelEdit={() => setEditingMessageId(null)}
                    />
                  ))
              ) : (
                <div className="text-neutral-600">no messages yet</div>
              )}
            </div>
          </div>

          <TypingIndicator channelId={channelId} />

          <ChatInput
            content={content}
            setContent={setContent}
            onSubmit={handleSubmit}
            placeholder={`> message #${channel?.name ?? ""}`}
          />
        </div>

        <div className="flex flex-col gap-2 overflow-hidden p-3">
          <Label>members ({authorList.length})</Label>
          <div className="flex-1 overflow-y-auto flex-col">
            {authorList.length ? (
              authorList.map((author) => (
                <ListAuthor key={author.id} author={author} />
              ))
            ) : (
              <div className="text-neutral-600">no authors</div>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
