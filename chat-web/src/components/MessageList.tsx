import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CachedMessage } from "src/lib/cache";
import { fetchMessages } from "src/lib/api";
import { Message } from "./Message";

export type MessageListProps = {
  readonly channelId: string;
  readonly messages: CachedMessage[];
  readonly editingMessageId: string | null;
  readonly setEditingMessageId: (id: string | null) => void;
};

const PAGE_SIZE = 50;
const BOTTOM_PADDING_PX = 16;
const ESTIMATED_ROW_HEIGHT_PX = 72;
const PINNED_TO_BOTTOM_THRESHOLD_PX = 80;
const TOP_FETCH_THRESHOLD_PX = 220;

export function MessageList({
  channelId,
  messages,
  editingMessageId,
  setEditingMessageId,
}: MessageListProps) {
  const bottomPadding = BOTTOM_PADDING_PX;
  const tupledMessages = useMemo(() => {
    return messages.map((message, index) => {
      return [message, messages[index - 1] ?? null] as const;
    });
  }, [messages]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);
  const lastBeforeRef = useRef<string | null>(null);
  const pinnedToBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);
  const pendingAnchorRef = useRef<{ id: string; offsetWithin: number } | null>(
    null
  );
  const pendingAnchorPrevCountRef = useRef(0);

  const messagesRef = useRef(messages);
  const hasMoreRef = useRef(hasMore);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const getScrollElement = useCallback(() => scrollRef.current, []);
  const getItemKey = useCallback(
    (index: number) => messages[index]?.id ?? index,
    [messages]
  );
  const estimateSize = useCallback(() => ESTIMATED_ROW_HEIGHT_PX, []);

  const virtualizer = useVirtualizer(
    useMemo(
      () => ({
        count: tupledMessages.length,
        getScrollElement,
        getItemKey,
        estimateSize,
        overscan: 12,
        paddingEnd: bottomPadding,
        scrollPaddingEnd: bottomPadding,
        // prevents tight resize->notify->rerender loops by deferring measurements to rAF
        useAnimationFrameWithResizeObserver: true,
      }),
      [
        tupledMessages.length,
        getScrollElement,
        getItemKey,
        estimateSize,
        bottomPadding,
      ]
    )
  );

  useEffect(() => {
    setHasMore(true);
    setLoadingMore(false);
    setLoadMoreError(null);
    loadingMoreRef.current = false;
    lastBeforeRef.current = null;
    pinnedToBottomRef.current = true;
    didInitialScrollRef.current = false;
    pendingAnchorRef.current = null;
    pendingAnchorPrevCountRef.current = 0;
  }, [channelId]);

  const loadOlder = useCallback(async () => {
    if (!channelId) return;
    if (loadingMoreRef.current || !hasMoreRef.current) return;

    const currentMessages = messagesRef.current;
    if (!currentMessages.length) return;

    const oldest = currentMessages[0];
    const beforeIso = new Date(oldest.created_at).toISOString();
    if (lastBeforeRef.current === beforeIso) {
      // prevents "stuck at top" loops if scroll events spam while we're already fetching this page
      return;
    }

    setLoadMoreError(null);

    const prevBefore = lastBeforeRef.current;
    lastBeforeRef.current = beforeIso;

    const el = scrollRef.current;
    const scrollTop = el?.scrollTop ?? 0;

    // anchor the first visible message so prepend doesn't jump
    const firstVisible = virtualizer.getVirtualItems()[0];
    const anchorIndex = firstVisible?.index ?? 0;
    const anchorId = currentMessages[anchorIndex]?.id;
    const anchorStart = firstVisible?.start ?? 0;
    const offsetWithin = scrollTop - anchorStart;

    if (anchorId) {
      pendingAnchorRef.current = { id: anchorId, offsetWithin };
      pendingAnchorPrevCountRef.current = currentMessages.length;
    } else {
      pendingAnchorRef.current = null;
      pendingAnchorPrevCountRef.current = 0;
    }

    setLoadingMore(true);
    loadingMoreRef.current = true;

    try {
      const beforeDate = new Date(oldest.created_at);
      // subtract 1ms so "before" never includes the current oldest due to precision weirdness
      beforeDate.setMilliseconds(beforeDate.getMilliseconds() - 1);

      const existingIds = new Set(currentMessages.map((m) => m.id));
      const res = await fetchMessages(
        channelId,
        undefined,
        beforeDate,
        PAGE_SIZE
      );

      const hasAnyNew = res.some((m) => !existingIds.has(m.id));
      if (!hasAnyNew) {
        pendingAnchorRef.current = null;
        pendingAnchorPrevCountRef.current = 0;
        lastBeforeRef.current = prevBefore;
        setHasMore(false);
        return;
      }

      if (res.length === 0) {
        setHasMore(false);
        return;
      }
      if (res.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (e) {
      // let the user retry by scrolling again
      lastBeforeRef.current = prevBefore;
      pendingAnchorRef.current = null;
      pendingAnchorPrevCountRef.current = 0;
      setLoadMoreError(e instanceof Error ? e.message : "failed to load more");
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [channelId, hasMoreRef, messagesRef, virtualizer]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight - bottomPadding;
    pinnedToBottomRef.current =
      distanceFromBottom < PINNED_TO_BOTTOM_THRESHOLD_PX;

    // if you're near the top, try paging older stuff
    if (el.scrollTop <= TOP_FETCH_THRESHOLD_PX) {
      if (!loadingMoreRef.current && hasMoreRef.current) {
        void loadOlder();
      }
    }
  }, [bottomPadding, loadOlder]);

  useLayoutEffect(() => {
    const pending = pendingAnchorRef.current;
    if (!pending) return;
    if (messages.length <= pendingAnchorPrevCountRef.current) return;

    const idx = messages.findIndex((m) => m.id === pending.id);
    if (idx < 0) {
      pendingAnchorRef.current = null;
      return;
    }

    // restore anchor after prepend
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(idx, { align: "start" });
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTop += pending.offsetWithin;
        if (el.scrollTop <= 0) el.scrollTop = 1;
        pendingAnchorRef.current = null;

        // if the list is still basically at the top, keep paging until it fills
        if (
          el.scrollTop <= TOP_FETCH_THRESHOLD_PX &&
          hasMoreRef.current &&
          !loadingMoreRef.current
        ) {
          void loadOlder();
        }
      });
    });
  }, [messages, virtualizer, loadOlder]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // when the input grows/shrinks, the scroll container height changes
    let raf = 0;
    const ro = new ResizeObserver(() => {
      // throttle to next frame so we don't spam layout
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (pinnedToBottomRef.current) {
          el.scrollTop = el.scrollHeight;
        }
      });
    });

    ro.observe(el);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [tupledMessages.length]);

  useLayoutEffect(() => {
    if (!tupledMessages.length) return;
    if (!scrollRef.current) return;

    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(tupledMessages.length - 1, { align: "end" });
      });
      return;
    }

    if (pinnedToBottomRef.current) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(tupledMessages.length - 1, { align: "end" });
      });
    }
  }, [tupledMessages.length, virtualizer]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto pr-1 min-h-0 pb-4 relative"
    >
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur pointer-events-none">
        {loadingMore && (
          <div className="text-tertiary text-xs py-2">loading more...</div>
        )}
        {!hasMore && tupledMessages.length > 0 && (
          <div className="text-secondary text-xs py-2">
            {`_.~"(_.~"(_.~"(_.~"(_.~"( end of the archives`}
          </div>
        )}
        {loadMoreError && (
          <div className="text-secondary text-xs py-2">{loadMoreError}</div>
        )}
      </div>

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
