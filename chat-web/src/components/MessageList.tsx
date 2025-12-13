import { useVirtualizer } from "@tanstack/react-virtual";
import type { CachedMessage } from "src/lib/cache";
import { cache } from "src/lib/cache";
import { fetchMessages } from "src/lib/api";
import { Message } from "./Message";

export type MessageListProps = {
  readonly channelId: string;
  readonly messages: CachedMessage[];
  readonly editingMessageId: string | null;
  readonly setEditingMessageId: (id: string | null) => void;
};

export function MessageList({
  channelId,
  messages,
  editingMessageId,
  setEditingMessageId,
}: MessageListProps) {
  // tuple messages with their previous message (for author grouping)
  const tupledMessages = useMemo(() => {
    return messages.map((message, index) => {
      return [message, messages[index - 1] ?? null] as const;
    });
  }, [messages]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pinnedToBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: tupledMessages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 12,
  });

  useEffect(() => {
    // reset paging state on channel switch
    setHasMore(true);
    setLoadingMore(false);
    pinnedToBottomRef.current = true;
    didInitialScrollRef.current = false;
  }, [channelId]);

  // real autoscroll: scroll to bottom on first load, and keep pinned-to-bottom behavior sane
  useLayoutEffect(() => {
    if (!tupledMessages.length) return;
    if (!scrollRef.current) return;

    // initial mount: jump to bottom
    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(tupledMessages.length - 1, { align: "end" });
      });
      return;
    }

    // new messages: only auto-follow if the user is already near bottom
    if (pinnedToBottomRef.current) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(tupledMessages.length - 1, { align: "end" });
      });
    }
  }, [tupledMessages.length, virtualizer]);

  async function loadOlder() {
    if (!channelId) return;
    if (loadingMore || !hasMore) return;
    if (!messages.length) return;

    const anchorIndex = virtualizer.getVirtualItems()?.[0]?.index ?? 0;
    const anchorId = messages[anchorIndex]?.id ?? messages[0]?.id;

    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const res = await fetchMessages(
        channelId,
        undefined,
        new Date(oldest.created_at),
        50
      );
      if (res.length < 50) {
        setHasMore(false);
      }

      // keep the current viewport anchored so loading older doesn't yank scroll
      requestAnimationFrame(() => {
        const next = cache.getState().messages[channelId] ?? {};
        const nextArr = Object.values(next).sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const nextIndex = nextArr.findIndex((m) => m.id === anchorId);
        if (nextIndex >= 0) {
          virtualizer.scrollToIndex(nextIndex, { align: "start" });
        }
      });
    } finally {
      setLoadingMore(false);
    }
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;

    // pinned-to-bottom detection
    const threshold = 80;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedToBottomRef.current = distanceFromBottom < threshold;

    // load older when you scroll near the top
    if (el.scrollTop < 200) {
      void loadOlder();
    }
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto pr-1 min-h-0 pb-4"
    >
      {loadingMore && (
        <div className="text-tertiary text-xs py-2">loading more...</div>
      )}
      {!hasMore && tupledMessages.length > 0 && (
        <div className="text-tertiary text-xs py-2">top of chat</div>
      )}

      {tupledMessages.length > 0 ? (
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((v) => {
            const [message, previousMessage] = tupledMessages[v.index]!;
            return (
              <div
                key={message.id}
                ref={virtualizer.measureElement}
                data-index={v.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${v.start}px)`,
                }}
              >
                <Message
                  message={message}
                  previousMessage={previousMessage ?? null}
                  editing={editingMessageId === message?.id}
                  onCancelEdit={() => setEditingMessageId(null)}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-tertiary">no messages yet</div>
      )}
    </div>
  );
}


