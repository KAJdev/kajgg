import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import {
  setChannelScrollInfo,
  useChannel,
  useChannelMessageBounds,
  useChannelMessages,
  useUser,
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
const FETCH_THRESHOLD_PX = 500;

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
  useChannel(channelId);
  const user = useUser();
  useChannelMessageBounds(channelId);

  const tupledMessages = useMemo(() => {
    const messagesArray = Object.values(rawMessages ?? {}).sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return messagesArray.map((message, index) => {
      return [message, messagesArray[index - 1] ?? null] as const;
    });
  }, [rawMessages]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadingOlderRef = useRef(false);
  const loadingNewerRef = useRef(false);
  const atBottomRef = useRef(true);
  const distFromBottomRef = useRef(0);
  const lastScrollTopRef = useRef(0);

  const [hasOlder, setHasOlder] = useState(true);
  const [hasNewer, setHasNewer] = useState(false);
  const [didInitialScroll, setDidInitialScroll] = useState(false);

  // stores scroll state right before we prepend so we can keep the viewport locked after dom updates
  const pendingPrependAdjustRef = useRef<{
    prevScrollTop: number;
    prevScrollHeight: number;
    anchorId: string | null;
    anchorTopFromScroller: number;
  } | null>(null);

  // keeps the anchor row pinned while images/embeds load and resize after prepend
  const anchorLockRef = useRef<{
    anchorId: string;
    topFromScroller: number;
    until: number;
  } | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const observedAnchorRef = useRef<HTMLElement | null>(null);
  const roRafRef = useRef<number | null>(null);

  const noNewerUntilRef = useRef(0);
  const noOlderUntilRef = useRef(0);

  const messages = tupledMessages;
  const firstMessageId = messages[0]?.[0]?.id;
  const lastMessageId = messages.length
    ? messages[messages.length - 1]?.[0]?.id
    : undefined;

  useEffect(() => {
    // reset paging state when switching channels lol
    loadingOlderRef.current = false;
    loadingNewerRef.current = false;
    atBottomRef.current = true;
    distFromBottomRef.current = 0;
    lastScrollTopRef.current = 0;
    pendingPrependAdjustRef.current = null;
    anchorLockRef.current = null;
    if (resizeObserverRef.current && observedAnchorRef.current) {
      resizeObserverRef.current.unobserve(observedAnchorRef.current);
    }
    observedAnchorRef.current = null;
    setHasOlder(true);
    // default to "unknown/true" so scroll-down can try once (then it'll disable itself if empty)
    setHasNewer(true);
    setDidInitialScroll(false);
    noNewerUntilRef.current = 0;
    noOlderUntilRef.current = 0;
  }, [channelId]);

  useEffect(() => {
    // yo: ro lets us counteract post-prepend resizes (images loading, embeds, etc) without extra react renders
    if (typeof ResizeObserver === "undefined") return;

    const obs = new ResizeObserver(() => {
      if (roRafRef.current !== null) return;
      roRafRef.current = window.requestAnimationFrame(() => {
        roRafRef.current = null;

        const scroller = scrollerRef.current;
        const lock = anchorLockRef.current;
        if (!scroller || !lock) return;

        if (Date.now() > lock.until) {
          anchorLockRef.current = null;
          if (resizeObserverRef.current && observedAnchorRef.current) {
            resizeObserverRef.current.unobserve(observedAnchorRef.current);
          }
          observedAnchorRef.current = null;
          return;
        }

        const anchorEl = innerRef.current?.querySelector(
          `[data-message-id="${lock.anchorId}"]`
        ) as HTMLElement | null;
        if (!anchorEl) {
          anchorLockRef.current = null;
          if (resizeObserverRef.current && observedAnchorRef.current) {
            resizeObserverRef.current.unobserve(observedAnchorRef.current);
          }
          observedAnchorRef.current = null;
          return;
        }

        const scrollerRect = scroller.getBoundingClientRect();
        const anchorRect = anchorEl.getBoundingClientRect();
        const nextTopFromScroller = anchorRect.top - scrollerRect.top;
        const delta = nextTopFromScroller - lock.topFromScroller;

        // ignore subpixel noise so we don't jitter
        if (Math.abs(delta) >= 0.5) {
          scroller.scrollTop += delta;
        }

        lock.topFromScroller = nextTopFromScroller;
      });
    });

    resizeObserverRef.current = obs;
    return () => {
      if (roRafRef.current !== null) {
        window.cancelAnimationFrame(roRafRef.current);
        roRafRef.current = null;
      }
      obs.disconnect();
      if (resizeObserverRef.current === obs) {
        resizeObserverRef.current = null;
      }
      observedAnchorRef.current = null;
      anchorLockRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const pending = pendingPrependAdjustRef.current;
    if (!scroller || !pending) return;

    const anchorEl = pending.anchorId
      ? (innerRef.current?.querySelector(
          `[data-message-id="${pending.anchorId}"]`
        ) as HTMLElement | null)
      : null;

    if (anchorEl) {
      const scrollerRect = scroller.getBoundingClientRect();
      const anchorRect = anchorEl.getBoundingClientRect();
      const nextTopFromScroller = anchorRect.top - scrollerRect.top;
      const delta = nextTopFromScroller - pending.anchorTopFromScroller;
      scroller.scrollTop += delta;

      // lock the anchor briefly so post-load resizes don't make the viewport drift
      const scrollerRect2 = scroller.getBoundingClientRect();
      const anchorRect2 = anchorEl.getBoundingClientRect();
      anchorLockRef.current = {
        anchorId: pending.anchorId ?? anchorEl.dataset.messageId ?? "",
        topFromScroller: anchorRect2.top - scrollerRect2.top,
        until: Date.now() + 2_000,
      };
      const obs = resizeObserverRef.current;
      if (obs) {
        if (observedAnchorRef.current) obs.unobserve(observedAnchorRef.current);
        obs.observe(anchorEl);
        observedAnchorRef.current = anchorEl;
      }
    } else {
      // fallback: keep the same distance-from-top by using the scrollheight delta
      const nextScrollHeight = scroller.scrollHeight;
      const delta = nextScrollHeight - pending.prevScrollHeight;
      scroller.scrollTop = pending.prevScrollTop + delta;

      // no reliable anchor => no resize lock
      anchorLockRef.current = null;
      if (resizeObserverRef.current && observedAnchorRef.current) {
        resizeObserverRef.current.unobserve(observedAnchorRef.current);
      }
      observedAnchorRef.current = null;
    }

    pendingPrependAdjustRef.current = null;

    // chill for a sec so we don't immediately chain-fetch while we're still near the top lol
    noOlderUntilRef.current = Date.now() + 250;
    // note: don't depend only on messages.length, because at the cache cap a prepend can evict from bottom and keep length the same
  }, [channelId, messages.length, firstMessageId, lastMessageId]);

  useEffect(() => {
    // if channel mounts without any cached messages, fetch an initial page
    if (!channelId) return;
    if (messages.length) return;
    void fetchMessages(channelId, undefined, undefined, PAGE_SIZE)
      .then((msgs) => {
        // api returns newest-first; if we got a full page, there might be older history
        setHasOlder(msgs.length === PAGE_SIZE);
        // we just pulled from the newest edge, so assume no newer until proven otherwise
        setHasNewer(false);
        noNewerUntilRef.current = Date.now() + 5_000;
      })
      .catch(() => {
        // ignore, ui will just stay empty
      });
  }, [channelId, messages.length]);

  useEffect(() => {
    // do the first scroll-to-bottom once we actually have messages rendered
    if (didInitialScroll) return;
    if (!messages.length) return;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
      atBottomRef.current = true;
      distFromBottomRef.current = 0;
      setDidInitialScroll(true);
    });
  }, [didInitialScroll, messages.length]);

  const getAnchorBeforePrepend = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return null;

    const container = innerRef.current;
    if (!container) return null;

    const scrollerRect = scroller.getBoundingClientRect();
    const messageEls =
      container.querySelectorAll<HTMLElement>("[data-message-id]");
    if (!messageEls.length) return null;

    // pick the first visible-ish message so we preserve what the user is actually looking at
    let anchor: HTMLElement | null = null;
    for (const el of messageEls) {
      const rect = el.getBoundingClientRect();
      if (rect.bottom > scrollerRect.top + 1) {
        anchor = el;
        break;
      }
    }
    anchor ??= messageEls[0] ?? null;
    if (!anchor) return null;

    const anchorRect = anchor.getBoundingClientRect();
    const anchorTopFromScroller = anchorRect.top - scrollerRect.top;

    return {
      anchorId: anchor.dataset.messageId ?? null,
      anchorTopFromScroller,
    };
  }, []);

  const loadOlder = useCallback(async () => {
    if (!hasOlder) return;
    if (loadingOlderRef.current) return;
    if (Date.now() < noOlderUntilRef.current) return;
    const scroller = scrollerRef.current;
    const first = messages[0]?.[0];
    if (!scroller || !first) return;

    loadingOlderRef.current = true;
    const anchorInfo = getAnchorBeforePrepend();
    pendingPrependAdjustRef.current = {
      prevScrollTop: scroller.scrollTop,
      prevScrollHeight: scroller.scrollHeight,
      anchorId: anchorInfo?.anchorId ?? null,
      anchorTopFromScroller: anchorInfo?.anchorTopFromScroller ?? 0,
    };

    try {
      const msgs = await fetchMessages(
        channelId,
        undefined,
        new Date(first.created_at),
        PAGE_SIZE,
        undefined,
        undefined,
        { mode: "prepend" }
      );
      setHasOlder(msgs.length === PAGE_SIZE);
      // when we pull older, the cache may evict from the bottom, so enable forward paging again
      setHasNewer(true);
    } catch {
      // if we fail, drop the pending adjust so we don't jump later
      pendingPrependAdjustRef.current = null;
    } finally {
      loadingOlderRef.current = false;
    }
  }, [channelId, getAnchorBeforePrepend, hasOlder, messages]);

  const loadNewer = useCallback(async () => {
    if (!hasNewer) return;
    if (loadingNewerRef.current) return;
    if (Date.now() < noNewerUntilRef.current) return;
    const last = messages.at(-1)?.[0];
    if (!last) return;

    loadingNewerRef.current = true;
    try {
      const msgs = await fetchMessages(
        channelId,
        new Date(last.created_at),
        undefined,
        PAGE_SIZE,
        undefined,
        undefined,
        { mode: "append" }
      );
      setHasNewer(msgs.length === PAGE_SIZE);
      if (msgs.length < PAGE_SIZE) {
        noNewerUntilRef.current = Date.now() + 5_000;
      }
    } finally {
      loadingNewerRef.current = false;
    }
  }, [channelId, hasNewer, messages]);

  const onScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
      const deltaTop = scrollTop - lastScrollTopRef.current;
      lastScrollTopRef.current = scrollTop;

      const distFromBottom = Math.max(
        0,
        scrollHeight - (scrollTop + clientHeight)
      );
      const atBottom = distFromBottom <= 60;
      atBottomRef.current = atBottom;
      distFromBottomRef.current = distFromBottom;
      setChannelScrollInfo(channelId, { atBottom, distFromBottom });

      const isNearBottom =
        scrollTop + clientHeight >= scrollHeight - FETCH_THRESHOLD_PX;
      const isNearTop = scrollTop <= FETCH_THRESHOLD_PX;

      // only fetch older when the user is actually scrolling up into the top zone
      // this avoids a fetch loop when we programmatically adjust scrolltop to preserve anchor
      if (isNearTop && deltaTop < 0) {
        void loadOlder();
      } else if (isNearBottom) {
        void loadNewer();
      }
    },
    [channelId, loadNewer, loadOlder]
  );

  useEffect(() => {
    // if you're pinned to bottom and new messages come in, keep it glued
    if (!messages.length) return;
    const newMessage = messages.at(-1)?.[0];
    // only skip if you're not pinned to bottom and the new message is not yours
    if (
      (!atBottomRef.current && newMessage?.author_id !== user?.id) ||
      hasNewer // if we are viewing an older window, we don't want to scroll to bottom
    )
      return;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  return (
    <div
      ref={scrollerRef}
      className="min-h-0 h-full overflow-y-auto"
      style={{ overflowAnchor: "none" }}
      onScroll={onScroll}
    >
      <div ref={innerRef} className="flex flex-col gap-1">
        <div ref={topSentinelRef} className="h-px" />
        {messages.map((item) => (
          <MessageRow
            key={item[0].id}
            item={item}
            editingMessageId={editingMessageId}
            setEditingMessageId={setEditingMessageId}
            onQuote={onQuote}
          />
        ))}
        <div className="h-4" ref={bottomRef} />
      </div>
    </div>
  );
}
