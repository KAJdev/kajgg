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

  const [hasOlder, setHasOlder] = useState(true);
  const [hasNewer, setHasNewer] = useState(false);
  const [didInitialScroll, setDidInitialScroll] = useState(false);
  const [prependTick, setPrependTick] = useState(0);

  // stores scroll state right before we prepend, so we can restore the viewport after dom updates
  const pendingPrependAdjustRef = useRef<{
    prevScrollTop: number;
    prevScrollHeight: number;
    anchorId: string | null;
    anchorOffsetTop: number;
  } | null>(null);

  const noNewerUntilRef = useRef(0);

  const messages = tupledMessages;

  useEffect(() => {
    // reset paging state when switching channels
    loadingOlderRef.current = false;
    loadingNewerRef.current = false;
    atBottomRef.current = true;
    distFromBottomRef.current = 0;
    pendingPrependAdjustRef.current = null;
    setHasOlder(true);
    // default to "unknown/true" so scroll-down can try once (then it'll disable itself if empty)
    setHasNewer(true);
    setDidInitialScroll(false);
    setPrependTick(0);
    noNewerUntilRef.current = 0;
  }, [channelId]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const pending = pendingPrependAdjustRef.current;
    if (!scroller || !pending) return;

    const rootTop = scroller.getBoundingClientRect().top;
    const anchorEl = pending.anchorId
      ? (innerRef.current?.querySelector(
          `[data-message-id="${pending.anchorId}"]`
        ) as HTMLElement | null)
      : null;

    if (anchorEl) {
      const nextOffset = anchorEl.getBoundingClientRect().top - rootTop;
      scroller.scrollTop += nextOffset - pending.anchorOffsetTop;
    } else {
      // fallback: keep the same distance-from-top by using scrollheight delta
      const nextScrollHeight = scroller.scrollHeight;
      const delta = nextScrollHeight - pending.prevScrollHeight;
      scroller.scrollTop = pending.prevScrollTop + delta;
    }

    pendingPrependAdjustRef.current = null;
  }, [prependTick, channelId]);

  useEffect(() => {
    // if channel mounts without any cached messages, fetch an initial page
    if (!channelId) return;
    if (messages.length) return;
    void fetchMessages(channelId, undefined, undefined, PAGE_SIZE)
      .then((msgs) => {
        // api returns newest-first; if we got a full page, there might be older history
        setHasOlder(msgs.length === PAGE_SIZE);
        // we just pulled from the "newest" edge, so assume no newer until proven otherwise
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

  const loadOlder = useCallback(async () => {
    if (!hasOlder) return;
    if (loadingOlderRef.current) return;
    const scroller = scrollerRef.current;
    const first = messages[0]?.[0];
    if (!scroller || !first) return;

    loadingOlderRef.current = true;
    // pick an anchor element currently in view so we can keep it in the same spot
    const rootTop = scroller.getBoundingClientRect().top;
    const els =
      innerRef.current?.querySelectorAll<HTMLElement>("[data-message-id]") ??
      [];
    let anchor: HTMLElement | null = null;
    for (const el of els) {
      const top = el.getBoundingClientRect().top;
      if (top >= rootTop) {
        anchor = el;
        break;
      }
    }
    if (!anchor && els.length) anchor = els[0] ?? null;

    pendingPrependAdjustRef.current = {
      prevScrollTop: scroller.scrollTop,
      prevScrollHeight: scroller.scrollHeight,
      anchorId: anchor?.dataset.messageId ?? null,
      anchorOffsetTop: anchor
        ? anchor.getBoundingClientRect().top - rootTop
        : 0,
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
      setPrependTick((t) => t + 1);
    } catch {
      // if we fail, drop the pending adjust so we don't jump later
      pendingPrependAdjustRef.current = null;
    } finally {
      loadingOlderRef.current = false;
    }
  }, [channelId, hasOlder, messages]);

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

      if (isNearTop) {
        void loadOlder();
      } else if (isNearBottom) {
        void loadNewer();
      }
    },
    [channelId, loadNewer, loadOlder]
  );

  useEffect(() => {
    const root = scrollerRef.current;
    const target = topSentinelRef.current;
    if (!root || !target) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        void loadOlder();
      },
      {
        root,
        rootMargin: "400px 0px 0px 0px",
        threshold: 0,
      }
    );

    obs.observe(target);
    return () => obs.disconnect();
  }, [loadOlder, channelId]);

  useEffect(() => {
    // if you're pinned to bottom and new messages come in, keep it glued
    if (!messages.length) return;
    if (!atBottomRef.current) return;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
  }, [messages.length]);

  return (
    <div
      ref={scrollerRef}
      className="min-h-0 h-full overflow-y-auto"
      onScroll={onScroll}
    >
      <div ref={innerRef} className="flex flex-col">
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
        <div className="h-8" ref={bottomRef} />
      </div>
    </div>
  );
}
