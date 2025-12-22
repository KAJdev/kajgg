import { create } from "zustand";
import {
  addChannel,
  cache,
  getToken,
  removeMessage,
  reconcileMessageByNonce,
  startTyping,
  stopTyping,
  tokenCache,
  updateAuthor,
  updateChannel,
  addAuthor,
  removeChannel,
  addChannelMember,
  removeChannelMember,
} from "./cache";
import type { Event } from "@schemas/events/event";
import { EventType } from "@schemas/events/eventtype";
import { MessageType } from "@schemas/index";

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

type SseClient = {
  close: () => void;
};

function buildGatewayUrl() {
  const url = new URL(`${GATEWAY_URL}/gateway`);

  const last_event_ts = cache.getState().last_event_ts;
  if (last_event_ts) {
    url.searchParams.set("last_event_ts", last_event_ts.toString());
  }

  const token = getToken();
  if (token) {
    url.searchParams.set("token", token);
  }

  return url;
}

function createSseClient(): SseClient {
  const abort = new AbortController();
  let closed = false;
  let retryMs = 500;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleRetry = (reason: unknown) => {
    if (closed) return;
    logFancy("warn", "[gateway]", "sse retrying", reason ?? "");
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      void connectLoop();
    }, retryMs);
    retryMs = Math.min(Math.floor(retryMs * 1.5), 10_000);
  };

  const connectLoop = async () => {
    if (closed) return;

    const url = buildGatewayUrl();

    try {
      const resp = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
        },
        signal: abort.signal,
      });

      // if a proxy returns 502/503/etc, eventsource can get stuck.
      // we treat any non-200 as retryable.
      if (!resp.ok) {
        scheduleRetry({ status: resp.status });
        return;
      }

      const ct = resp.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream")) {
        scheduleRetry({ status: resp.status, contentType: ct });
        return;
      }

      retryMs = 500;
      logFancy("info", "[gateway]", "sse connected");

      if (!resp.body) {
        scheduleRetry("no response body");
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      let buf = "";
      let dataLines: string[] = [];

      while (!closed) {
        const { value, done } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const rawLine = buf.slice(0, idx);
          buf = buf.slice(idx + 1);

          const line = rawLine.replace(/\r$/, "");
          if (line === "") {
            // end of event
            if (dataLines.length) {
              const dataStr = dataLines.join("\n");
              dataLines = [];
              try {
                const data: Event = JSON.parse(dataStr);
                handleEvent(data);
              } catch (err) {
                logFancy("error", "[gateway]", "malformed frame", err);
              }
            }
            continue;
          }

          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trimStart());
          }
        }
      }

      scheduleRetry("stream closed");
    } catch (err) {
      if (abort.signal.aborted) return;
      scheduleRetry(err);
    }
  };

  void connectLoop();

  return {
    close: () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      abort.abort();
    },
  };
}

const useEventSource = create<{
  eventSource: SseClient | null;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}>((set, get) => ({
  eventSource: null,
  connect: () => {
    set({ eventSource: createSseClient() });
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
    set({ eventSource: createSseClient() });
  },
}));

function handleEvent(event: Event) {
  logFancy("info", "[gateway]", `${event.t}`, event.d ?? levelStyles.dim);

  if ("ts" in event && typeof event.ts === "number") {
    cache.setState({ last_event_ts: event.ts });
  }

  switch (event.t) {
    case EventType.CHANNEL_CREATED:
      return addChannel(event.d.channel);
    case EventType.CHANNEL_UPDATED:
      return updateChannel(event.d.channel);
    case EventType.MESSAGE_CREATED:
      return (
        reconcileMessageByNonce(
          event.d.message.channel_id,
          event.d.message,
          "add"
        ),
        stopTyping(event.d.message.channel_id, event.d.message.author_id),
        event.d.author &&
          !event.d.author.flags?.webhook &&
          addAuthor(event.d.author),
        event.d.message.type === MessageType.JOIN &&
          addChannelMember(
            event.d.message.channel_id,
            event.d.message.author_id
          ),
        event.d.message.type === MessageType.LEAVE &&
          removeChannelMember(
            event.d.message.channel_id,
            event.d.message.author_id
          )
      );
    case EventType.MESSAGE_UPDATED:
      return (
        reconcileMessageByNonce(
          event.d.message.channel_id,
          event.d.message,
          "update"
        ),
        stopTyping(event.d.message.channel_id, event.d.message.author_id)
      );
    case EventType.MESSAGE_DELETED:
      return removeMessage(event.d.channel_id, event.d.message_id);
    case EventType.AUTHOR_UPDATED:
      return updateAuthor(event.d.author);
    case EventType.TYPING_STARTED:
      return startTyping(event.d.channel_id, event.d.user_id);
    case EventType.CHANNEL_DELETED:
      return removeChannel(event.d.channel_id);
    default: {
      if ((event as unknown as { t: string }).t === EventType.HEARTBEAT) {
        return;
      }

      logFancy(
        "warn",
        "[gateway]",
        `unknown event type: ${(event as unknown as { t: string }).t}`
      );
    }
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
