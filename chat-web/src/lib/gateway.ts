import { create } from "zustand";
import {
  addChannel,
  addMessage,
  cache,
  getToken,
  removeMessage,
  tokenCache,
  updateAuthor,
  updateMessage,
} from "./cache";
import type { Event } from "@schemas/events/event";
import { EventType } from "@schemas/events/eventtype";

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;

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

  eventSource.onmessage = (event) => {
    try {
      const data: Event = JSON.parse(event.data);
      handleEvent(data);
    } catch (err) {
      console.error("Invalid JSON", err);
    }
  };

  eventSource.onerror = (err) => {
    console.error("SSE error", err);
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
  console.log("[Gateway] Received event:", event.t, event.d);
  switch (event.t) {
    case EventType.CHANNEL_CREATED:
      return addChannel(event.d.channel);
    case EventType.MESSAGE_CREATED:
      return addMessage(event.d.channel.id, event.d.message);
    case EventType.MESSAGE_UPDATED:
      return updateMessage(event.d.message.channel_id, event.d.message);
    case EventType.MESSAGE_DELETED:
      return removeMessage(event.d.message_id, event.d.channel_id);
    case EventType.AUTHOR_UPDATED:
      return updateAuthor(event.d.author);
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
