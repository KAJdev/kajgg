import { useMemo, useRef } from "react";
import {
  useChannelMessages,
  useVirtuosoFirstItemIndex,
  type CachedMessage,
} from "src/lib/cache";
import { fetchMessages } from "src/lib/api";
import { Message } from "./Message";
import { Virtuoso } from "react-virtuoso";

export type MessageListProps = {
  readonly channelId: string;
  readonly editingMessageId: string | null;
  readonly setEditingMessageId: (id: string | null) => void;
};

const PAGE_SIZE = 100;

type MessageTuple = readonly [
  message: CachedMessage,
  previous: CachedMessage | null
];

function MessageRow({
  item,
  editingMessageId,
  setEditingMessageId,
}: Readonly<{
  item: MessageTuple;
  editingMessageId: string | null;
  setEditingMessageId: (id: string | null) => void;
}>) {
  const [message, previousMessage] = item;
  return (
    <Message
      message={message}
      previousMessage={previousMessage}
      onCancelEdit={() => setEditingMessageId(null)}
      editing={editingMessageId === message.id}
    />
  );
}

function messageItemContent(
  editingMessageId: string | null,
  setEditingMessageId: (id: string | null) => void
) {
  return (_index: number, item: MessageTuple) => (
    <MessageRow
      item={item}
      editingMessageId={editingMessageId}
      setEditingMessageId={setEditingMessageId}
    />
  );
}

const listComponents = {
  Footer: () => <div className="h-2" />,
} as const;

export function MessageList({
  channelId,
  editingMessageId,
  setEditingMessageId,
}: MessageListProps) {
  const firstItemIndex = useVirtuosoFirstItemIndex(channelId);
  const messages = useChannelMessages(channelId);
  const messagesArray = useMemo(() => {
    return Object.values(messages ?? {}).sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages]);

  const tupledMessages = useMemo(() => {
    return messagesArray.map((message, index) => {
      return [message, messagesArray[index - 1] ?? null] as const;
    });
  }, [messagesArray]);

  const loadingRef = useRef(false);
  const lastBeforeCursorRef = useRef<string | null>(null);
  function fetchPreviousMessages() {
    if (loadingRef.current) return;
    if (!messagesArray.length) return;

    // prevent refetch loops when you're hovering near the top threshold
    const beforeCursor = `${messagesArray[0].id}:${new Date(
      messagesArray[0].created_at
    ).toISOString()}`;
    if (lastBeforeCursorRef.current === beforeCursor) return;
    lastBeforeCursorRef.current = beforeCursor;

    loadingRef.current = true;
    void fetchMessages(
      channelId,
      undefined,
      new Date(messagesArray[0].created_at),
      PAGE_SIZE,
      undefined,
      undefined,
      { mode: "prepend" }
    ).finally(() => {
      loadingRef.current = false;
    });
  }

  return (
    <Virtuoso
      data={tupledMessages as MessageTuple[]}
      style={{ height: "100%" }}
      alignToBottom
      skipAnimationFrameInResizeObserver
      firstItemIndex={firstItemIndex}
      followOutput={(isAtBottom) => (isAtBottom ? "auto" : false)}
      components={listComponents}
      atTopStateChange={(atTop) => {
        if (atTop) fetchPreviousMessages();
      }}
      atTopThreshold={500}
      computeItemKey={(_index, item) => item[0].id}
      itemContent={messageItemContent(editingMessageId, setEditingMessageId)}
    />
  );
}
