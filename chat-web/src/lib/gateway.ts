import { create } from "zustand";
import {
  addChannel,
  addMessage,
  cache,
  getToken,
  removeMessage,
  startTyping,
  stopTyping,
  tokenCache,
  updateAuthor,
  updateMessage,
} from "./cache";
import type { Event } from "@schemas/events/event";
import { EventType } from "@schemas/events/eventtype";

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;

const levelStyles: Record<string, string> = {
  info: "color:#22e08a;font-weight:600;",
  warn: "color:#f7c266;font-weight:600;",
  error: "color:#ff5f52;font-weight:700;",
  tag: "color:#7ae7ff;font-weight:700;",
  dim: "color:#8fa3b0;",
};

function logFancy(
  level: "info" | "warn" | "error",
  tag: string,
  message: string,
  extra?: unknown
) {
  const style = levelStyles[level] ?? "";
  console.log(`%c${tag}%c ${message}`, levelStyles.tag, style, extra ?? "");
}

function createEventSource() {
  const url = new URL(`${GATEWAY_URL}/gateway`);

  const last_event_ts = cache.getState().last_event_ts;
  if (last_event_ts) {
    url.searchParams.set("last_event_ts", last_event_ts.toString());
  }

  const token = getToken();
  if (token) {
    url.searchParams.set("token", token);
  }

  const eventSource = new EventSource(url.toString());

  eventSource.onopen = () => {
    logFancy("info", "[gateway]", "sse connected");
  };

  eventSource.onmessage = (event) => {
    try {
      const data: Event = JSON.parse(event.data);
      handleEvent(data);
    } catch (err) {
      logFancy("error", "[gateway]", "malformed frame", err);
    }
  };

  eventSource.onerror = (err) => {
    logFancy("error", "[gateway]", "sse error", err);
  };

  return eventSource;
}

const useEventSource = create<{
  eventSource: EventSource | null;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}>((set, get) => ({
  eventSource: null,
  connect: () => {
    set({ eventSource: createEventSource() });
  },
  disconnect: () => {
    const source = get().eventSource;
    if (source) {
      source.close();
    }
    set({ eventSource: null });
  },
  reconnect: () => {
    const source = get().eventSource;
    if (source) {
      source.close();
    }
    set({ eventSource: createEventSource() });
  },
}));

function handleEvent(event: Event) {
  logFancy("info", "[gateway]", `${event.t}`, event.d ?? levelStyles.dim);
  switch (event.t) {
    case EventType.CHANNEL_CREATED:
      return addChannel(event.d.channel);
    case EventType.MESSAGE_CREATED:
      return (
        addMessage(event.d.channel.id, event.d.message),
        stopTyping(event.d.channel.id, event.d.author.id)
      );
    case EventType.MESSAGE_UPDATED:
      return (
        updateMessage(event.d.message.channel_id, event.d.message),
        stopTyping(event.d.message.channel_id, event.d.message.author_id)
      );
    case EventType.MESSAGE_DELETED:
      return removeMessage(event.d.message_id, event.d.channel_id);
    case EventType.AUTHOR_UPDATED:
      return updateAuthor(event.d.author);
    case EventType.TYPING_STARTED:
      return startTyping(event.d.channel_id, event.d.user_id);
  }
}

export function useGateway() {
  const { eventSource, connect, disconnect, reconnect } = useEventSource();
  const { token } = tokenCache();

  useEffect(() => {
    if (token) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [connect, disconnect, token]);

  return { eventSource, connect, disconnect, reconnect } as const;
}
