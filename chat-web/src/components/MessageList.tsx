import { useEffect, useMemo, useRef } from "react";
import {
  useChannelMessages,
  useUser,
  useVirtuosoFirstItemIndex,
  type CachedMessage,
} from "src/lib/cache";
import { fetchMessages } from "src/lib/api";
import { Message } from "./Message";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

export type MessageListProps = {
  readonly channelId: string;
  readonly editingMessageId: string | null;
  readonly setEditingMessageId: (id: string | null) => void;
  readonly onQuote: (content: string) => void;
};

const PAGE_SIZE = 100;

type MessageTuple = readonly [
  message: CachedMessage,
  previous: CachedMessage | null
];

function MessageRow({
  item,
  editingMessageId,
  onQuote,
  setEditingMessageId,
}: Readonly<{
  item: MessageTuple;
  editingMessageId: string | null;
  setEditingMessageId: (id: string | null) => void;
  onQuote: (content: string) => void;
}>) {
  const [message, previousMessage] = item;
  return (
    <Message
      message={message}
      previousMessage={previousMessage}
      onCancelEdit={() => setEditingMessageId(null)}
      editing={editingMessageId === message.id}
      onEdit={setEditingMessageId}
      onQuote={onQuote}
    />
  );
}

function messageItemContent(
  editingMessageId: string | null,
  setEditingMessageId: (id: string | null) => void,
  onQuote: (content: string) => void
) {
  return (_index: number, item: MessageTuple) => (
    <MessageRow
      item={item}
      editingMessageId={editingMessageId}
      setEditingMessageId={setEditingMessageId}
      onQuote={onQuote}
    />
  );
}

const listComponents = {
  Footer: () => <div className="h-8" />,
} as const;

export function MessageList({
  channelId,
  editingMessageId,
  setEditingMessageId,
  onQuote,
}: MessageListProps) {
  const firstItemIndex = useVirtuosoFirstItemIndex(channelId);
  const self = useUser();
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

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const lastSnappedMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const last = messagesArray.at(-1);
    if (!last) return;

    const myId = self?.id ?? "me";
    if (last.author_id !== myId) return;
    if (lastSnappedMessageIdRef.current === last.id) return;
    lastSnappedMessageIdRef.current = last.id;

    // if you sent it, we snap. no questions asked.
    const lastIndex = tupledMessages.length - 1;
    if (lastIndex < 0) return;

    // virtuoso uses "item index space" when firstItemIndex is set,
    // so we need to scroll to firstItemIndex + lastIndex, not just lastIndex.
    const virtuosoIndex = firstItemIndex + lastIndex;

    requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({
        index: virtuosoIndex,
        align: "end",
        behavior: "auto",
      });
    });
  }, [messagesArray, self?.id, tupledMessages.length, firstItemIndex]);

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
      ref={virtuosoRef}
      data={tupledMessages as MessageTuple[]}
      style={{ height: "100%", minHeight: 0 }}
      alignToBottom
      skipAnimationFrameInResizeObserver
      initialTopMostItemIndex={{ index: "LAST" }}
      firstItemIndex={firstItemIndex}
      followOutput={(isAtBottom) => (isAtBottom ? "auto" : false)}
      atBottomThreshold={96}
      components={listComponents}
      atTopStateChange={(atTop) => {
        if (atTop) fetchPreviousMessages();
      }}
      atTopThreshold={500}
      computeItemKey={(_index, item) => item[0].id}
      itemContent={messageItemContent(
        editingMessageId,
        setEditingMessageId,
        onQuote
      )}
    />
  );
}
