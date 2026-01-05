/* eslint-disable no-empty */
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  useChannel,
  useChannelMessages,
  type CachedMessage,
} from "src/lib/cache";
import { fetchMessages } from "src/lib/api";
import { Message } from "./Message";

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

const MessageRow = memo(function MessageRow({
  item,
  editingMessageId,
  setEditingMessageId,
  onQuote,
}: Readonly<{
  item: MessageTuple;
  editingMessageId: string | null;
  setEditingMessageId: (id: string | null) => void;
  onQuote: (content: string) => void;
}>) {
  const [message, previousMessage] = item;
  return (
    <div data-message-id={message.id}>
      <Message
        message={message}
        previousMessage={previousMessage}
        onCancelEdit={() => setEditingMessageId(null)}
        editing={editingMessageId === message.id}
        onEdit={setEditingMessageId}
        onQuote={onQuote}
      />
    </div>
  );
});

export function MessageList({
  channelId,
  editingMessageId,
  setEditingMessageId,
  onQuote,
}: MessageListProps) {
  const rawMessages = useChannelMessages(channelId);
  const channel = useChannel(channelId);

  const messages = useMemo(() => {
    const messagesArray = Object.values(rawMessages ?? {}).sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return messagesArray.map((message, index) => {
      return [message, messagesArray[index - 1] ?? null] as const;
    });
  }, [rawMessages]);

  const loadOlder = useCallback(async () => {
    const first = messages[0]?.[0];
    if (!first) return;
    try {
      await fetchMessages(
        channelId,
        undefined,
        new Date(first.created_at),
        PAGE_SIZE,
        undefined,
        undefined,
        { mode: "prepend" }
      );
    } catch {}
  }, [channelId, messages]);

  const loadNewer = useCallback(async () => {
    const last = messages.at(-1)?.[0];
    if (!last) return;
    try {
      await fetchMessages(
        channelId,
        new Date(last.created_at),
        undefined,
        PAGE_SIZE,
        undefined,
        undefined,
        { mode: "append" }
      );
    } catch {}
  }, [channelId, messages]);

  return (
    <MessageListScroller
      messages={messages}
      loadOlder={loadOlder}
      loadNewer={loadNewer}
      lastMessageAt={new Date(channel?.last_message_at ?? 0).getTime()}
      editingMessageId={editingMessageId}
      setEditingMessageId={setEditingMessageId}
      onQuote={onQuote}
      topThresholdPx={500}
      bottomThresholdPx={50}
    />
  );
}

type Props = {
  messages: MessageTuple[];
  editingMessageId: string | null;
  setEditingMessageId: (id: string | null) => void;
  onQuote: (content: string) => void;
  /** Load older messages (prepend) when near TOP */
  loadOlder: () => void | Promise<void>;

  /** Load newer messages (append) when near BOTTOM but we're behind lastMessageAt */
  loadNewer: () => void | Promise<void>;

  /** Newest possible message timestamp available (server-side) */
  lastMessageAt: number | string;

  /** px thresholds */
  topThresholdPx?: number;
  bottomThresholdPx?: number;

  /** Optional: avoid spamming loads */
  isLoadingOlder?: boolean;
  isLoadingNewer?: boolean;

  className?: string;
  style?: React.CSSProperties;
};

function toMs(t: number | string): number {
  return typeof t === "number" ? t : Date.parse(t);
}

type Snapshot = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  wasAtBottom: boolean;

  // Anchor message (first visible) + offset within viewport
  anchorId: string | null;
  anchorOffsetTop: number; // anchorElTop - scrollTop
};

export function MessageListScroller({
  messages,
  editingMessageId,
  setEditingMessageId,
  onQuote,
  loadOlder,
  loadNewer,
  lastMessageAt,
  topThresholdPx = 500,
  bottomThresholdPx = 50,
  isLoadingOlder = false,
  isLoadingNewer = false,
  className,
  style,
}: Readonly<Props>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);

  // Used to decide how to behave on layout shifts
  const anchorModeRef = useRef<"bottom" | "stable">("bottom");

  // Previous render snapshot (captured after paint, used on next update)
  const prevSnapRef = useRef<Snapshot | null>(null);

  // In-flight guards (works even if parent doesn’t provide isLoading*)
  const olderInFlight = useRef(false);
  const newerInFlight = useRef(false);

  // For ResizeObserver delta fallback
  const roPrevScrollHeight = useRef<number>(0);

  const newestInListAt = useMemo(() => {
    const last = messages.at(-1);
    return last ? toMs(new Date(last[0].created_at).getTime()) : -Infinity;
  }, [messages]);

  const newestPossibleAt = useMemo(() => toMs(lastMessageAt), [lastMessageAt]);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return null;

    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;

    const distFromTop = scrollTop;
    const distFromBottom = scrollHeight - (scrollTop + clientHeight);

    const atTop = distFromTop <= topThresholdPx;
    const atBottom = distFromBottom <= bottomThresholdPx;

    return {
      el,
      scrollTop,
      scrollHeight,
      clientHeight,
      distFromTop,
      distFromBottom,
      atTop,
      atBottom,
    };
  }, [topThresholdPx, bottomThresholdPx]);

  const maybeLoadOlder = useCallback(() => {
    if (isLoadingOlder || olderInFlight.current) return;
    olderInFlight.current = true;

    Promise.resolve(loadOlder())
      .catch(() => {})
      .finally(() => {
        olderInFlight.current = false;
      });
  }, [isLoadingOlder, loadOlder]);

  const maybeLoadNewer = useCallback(() => {
    if (isLoadingNewer || newerInFlight.current) return;
    if (newestInListAt >= newestPossibleAt) return;

    newerInFlight.current = true;

    Promise.resolve(loadNewer())
      .catch(() => {})
      .finally(() => {
        newerInFlight.current = false;
      });
  }, [isLoadingNewer, loadNewer, newestInListAt, newestPossibleAt]);

  /**
   * Find the first message element that is at least partially visible,
   * and record its id and offset relative to the viewport top.
   */
  const captureAnchor = useCallback((): {
    anchorId: string | null;
    anchorOffsetTop: number;
  } => {
    const scroller = scrollerRef.current;
    const inner = innerRef.current;
    if (!scroller || !inner) return { anchorId: null, anchorOffsetTop: 0 };

    const scrollTop = scroller.scrollTop;
    const children = Array.from(inner.children) as HTMLElement[];

    for (const child of children) {
      const top = child.offsetTop;
      const bottom = top + child.offsetHeight;

      // first element that is not fully above viewport
      if (bottom > scrollTop) {
        const anchorId = child.dataset.id ?? null;
        const anchorOffsetTop = top - scrollTop; // preserve this across mutations
        return { anchorId, anchorOffsetTop };
      }
    }

    return { anchorId: null, anchorOffsetTop: 0 };
  }, []);

  const updateSnapshotFromDOM = useCallback(() => {
    const m = measure();
    if (!m) return;

    const { anchorId, anchorOffsetTop } = captureAnchor();

    prevSnapRef.current = {
      scrollTop: m.el.scrollTop,
      scrollHeight: m.el.scrollHeight,
      clientHeight: m.el.clientHeight,
      wasAtBottom: m.atBottom,
      anchorId,
      anchorOffsetTop,
    };
  }, [measure, captureAnchor]);

  /**
   * Restore viewport using the anchor (best) or scrollHeight delta (fallback).
   */
  const restoreViewportStable = useCallback((prev: Snapshot) => {
    const scroller = scrollerRef.current;
    const inner = innerRef.current;
    if (!scroller || !inner) return;

    // Preferred: anchor element restore (handles add/remove anywhere, rolling windows)
    if (prev.anchorId) {
      const el = inner.querySelector<HTMLElement>(
        `[data-id="${CSS.escape(prev.anchorId)}"]`
      );
      if (el) {
        scroller.scrollTop = el.offsetTop - prev.anchorOffsetTop;
        return;
      }
    }

    // Fallback: height-delta (handles many cases, but not perfect for arbitrary removals)
    const nextScrollHeight = scroller.scrollHeight;
    const delta = nextScrollHeight - prev.scrollHeight;
    scroller.scrollTop = prev.scrollTop + delta;
  }, []);

  /**
   * Scroll listener: updates anchor mode and triggers loads (Req 5 & 7).
   */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let raf = 0;

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const m = measure();
        if (!m) return;

        anchorModeRef.current = m.atBottom ? "bottom" : "stable";

        if (m.atTop) maybeLoadOlder();
        if (m.atBottom) maybeLoadNewer();

        // keep snapshot fresh so message updates don't think we're pinned
        // when the user has scrolled up
        updateSnapshotFromDOM();
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, [measure, maybeLoadOlder, maybeLoadNewer, updateSnapshotFromDOM]);

  /**
   * Reconcile scroll position on ANY messages change, including rolling-window updates.
   * This runs AFTER React commits the new DOM.
   */
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const prev = prevSnapRef.current;

    // First mount: jump to bottom by default (chat UX)
    if (prev === null) {
      scroller.scrollTop = scroller.scrollHeight;
      anchorModeRef.current = "bottom";
      roPrevScrollHeight.current = scroller.scrollHeight;
    } else {
      const shouldPinToBottom = anchorModeRef.current === "bottom";

      if (shouldPinToBottom) {
        // if pinned, stay pinned
        scroller.scrollTop = scroller.scrollHeight;
        anchorModeRef.current = "bottom";
      } else {
        // otherwise keep viewport stable (anchor-based)
        restoreViewportStable(prev);
        anchorModeRef.current = "stable";
      }
      roPrevScrollHeight.current = scroller.scrollHeight;
    }

    // after we reconcile, capture a fresh snapshot for the next update
    updateSnapshotFromDOM();
  }, [messages, restoreViewportStable, updateSnapshotFromDOM]);

  /**
   * ResizeObserver for layout shifts (images loading, embeds expanding).
   * Keeps pinned bottom or stable anchor across height changes.
   */
  useEffect(() => {
    const inner = innerRef.current;
    const scroller = scrollerRef.current;
    if (!inner || !scroller) return;

    // Initialize
    roPrevScrollHeight.current = scroller.scrollHeight;

    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const sc = scrollerRef.current;
        const inr = innerRef.current;
        const prev = prevSnapRef.current;
        if (!sc || !inr) return;

        const nextScrollHeight = sc.scrollHeight;
        const delta = nextScrollHeight - roPrevScrollHeight.current;

        if (delta === 0) return;

        if (anchorModeRef.current === "bottom") {
          sc.scrollTop = sc.scrollHeight;
        } else if (prev) {
          // Use the most recent snapshot anchor to preserve what user is looking at
          restoreViewportStable(prev);
        } else {
          // Fallback: preserve scrollTop by delta
          sc.scrollTop = sc.scrollTop + delta;
        }

        roPrevScrollHeight.current = nextScrollHeight;

        // Refresh snapshot after applying adjustment so future updates are correct
        const m = measure();
        if (!m) return;
        const { anchorId, anchorOffsetTop } = captureAnchor();
        prevSnapRef.current = {
          scrollTop: m.el.scrollTop,
          scrollHeight: m.el.scrollHeight,
          clientHeight: m.el.clientHeight,
          wasAtBottom: m.atBottom,
          anchorId,
          anchorOffsetTop,
        };
      });
    });

    ro.observe(inner);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [measure, captureAnchor, restoreViewportStable]);

  return (
    <div
      ref={scrollerRef}
      className={className}
      style={{
        overflowY: "auto",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
        ...style,
      }}
    >
      <div ref={innerRef} className="flex flex-col gap-1">
        {messages.map((m) => (
          <div key={m[0].id} data-id={m[0].id}>
            <MessageRow
              item={m}
              editingMessageId={editingMessageId}
              setEditingMessageId={setEditingMessageId}
              onQuote={onQuote}
            />
          </div>
        ))}
        <div className="h-4" />
      </div>
    </div>
  );
}
