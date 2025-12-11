import type { Author } from "@schemas/models/author";
import type { Channel } from "@schemas/models/channel";
import type { Message } from "@schemas/models/message";
import type { User } from "@schemas/models/user";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/shallow";

type TimeoutId = ReturnType<typeof setTimeout>;

export type ClientUploadProgress = {
  /** 0..1 */
  progress: number;
  /** local preview url while uploading */
  preview_url?: string;
};

export type ClientMessageMeta = {
  status: "sending" | "sent" | "failed";
  uploads?: Record<string, ClientUploadProgress>;
  error?: string;
};

export type CachedMessage = Message & {
  /** client-only metadata for optimistic ui */
  client?: ClientMessageMeta;
};

export type Cache = {
  user?: User;
  channels: Record<string, Channel>;
  messages: Record<string, Record<string, CachedMessage>>;
  authors: Record<string, Author>;
  typing: Record<string, Record<string, TimeoutId>>;
  last_event_ts?: number;
};

export const cache = create<Cache>()(() => ({
  user: undefined,
  channels: {},
  messages: {},
  authors: {},
  typing: {},
  last_event_ts: undefined,
}));

export const tokenCache = create<{ token: string | null }>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token: string) => set({ token }),
    }),
    {
      name: "token",
    }
  )
);

export function setUser(user: User) {
  cache.setState({ user });
  tokenCache.setState({ token: user.token });
}

export function getToken() {
  return tokenCache.getState().token;
}

export function useToken() {
  return tokenCache(useShallow((state) => state.token));
}

export function setLastEventTs(last_event_ts: number) {
  cache.setState({ last_event_ts });
}

export function startTyping(channelId: string, userId: string) {
  const currentRoutine = cache.getState().typing[channelId]?.[userId];
  if (currentRoutine) {
    clearTimeout(currentRoutine);
  }

  const timeoutId = setTimeout(() => {
    cache.setState((state) => ({
      typing: {
        ...state.typing,
        [channelId]: Object.fromEntries(
          Object.entries(state.typing[channelId]).filter(
            ([id]) => id !== userId
          )
        ),
      },
    }));
  }, 10_000);

  cache.setState((state) => ({
    typing: {
      ...state.typing,
      [channelId]: { ...state.typing[channelId], [userId]: timeoutId },
    },
  }));
}

export function stopTyping(channelId: string, userId: string) {
  const currentRoutine = cache.getState().typing[channelId]?.[userId];
  if (currentRoutine) {
    clearTimeout(currentRoutine);
    cache.setState((state) => ({
      typing: {
        ...state.typing,
        [channelId]: Object.fromEntries(
          Object.entries(state.typing[channelId]).filter(
            ([id]) => id !== userId
          )
        ),
      },
    }));
  }
}

export function useTypingAuthors(channelId: string) {
  const ids = cache(
    useShallow((state) => Object.keys(state.typing[channelId] ?? {}))
  );
  const authors = useAuthors();
  return Object.values(authors).filter((author) => ids.includes(author.id));
}

export function addChannel(channel: Channel) {
  cache.setState((state) => ({
    channels: { ...state.channels, [channel.id]: channel },
  }));
}

export function addMessage(channelId: string, message: Message) {
  cache.setState((state) => ({
    messages: {
      ...state.messages,
      [channelId]: {
        ...state.messages[channelId],
        [message.id]: message as CachedMessage,
      },
    },
  }));
}

export function addOptimisticMessage(
  channelId: string,
  message: CachedMessage
) {
  cache.setState((state) => ({
    messages: {
      ...state.messages,
      [channelId]: {
        ...state.messages[channelId],
        [message.id]: message,
      },
    },
  }));
}

export function updateMessageById(
  channelId: string,
  messageId: string,
  patch: Partial<CachedMessage>
) {
  cache.setState((state) => ({
    messages: {
      ...state.messages,
      [channelId]: {
        ...state.messages[channelId],
        [messageId]: {
          ...(state.messages[channelId]?.[messageId] as CachedMessage),
          ...patch,
        },
      },
    },
  }));
}

export function reconcileMessageByNonce(
  channelId: string,
  serverMessage: Message
) {
  const nonce = serverMessage.nonce;
  if (!nonce) {
    return addMessage(channelId, serverMessage);
  }

  const messages = cache.getState().messages[channelId] ?? {};
  const optimisticId = Object.keys(messages).find(
    (id) => messages[id]?.nonce === nonce
  );

  const optimistic = optimisticId
    ? (messages[optimisticId] as CachedMessage)
    : null;

  if (optimisticId && optimisticId !== serverMessage.id) {
    removeMessage(channelId, optimisticId);
  }

  // keep client previews so image/video doesn't flash when swapping blob -> r2 url
  const merged: CachedMessage = {
    ...(serverMessage as CachedMessage),
    client: optimistic?.client
      ? {
          ...optimistic.client,
          status: "sent",
          // keep progress as-is; ui uses preview until remote loads
          uploads: optimistic.client.uploads,
        }
      : undefined,
  };

  addMessage(channelId, merged);
}

export function addAuthor(author: Author) {
  cache.setState((state) => ({
    authors: { ...state.authors, [author.id]: author },
  }));
}

export function removeChannel(channelId: string) {
  cache.setState((state) => ({
    channels: Object.fromEntries(
      Object.entries(state.channels).filter(([id]) => id !== channelId)
    ),
  }));
}

export function removeMessage(channelId: string, messageId: string) {
  cache.setState((state) => ({
    messages: {
      ...state.messages,
      [channelId]: Object.fromEntries(
        Object.entries(state.messages[channelId]).filter(
          ([id]) => id !== messageId
        )
      ),
    },
  }));
}

export function removeAuthor(authorId: string) {
  cache.setState((state) => ({
    authors: Object.fromEntries(
      Object.entries(state.authors).filter(([id]) => id !== authorId)
    ),
  }));
}

export function updateChannel(channel: Channel) {
  cache.setState((state) => ({
    channels: { ...state.channels, [channel.id]: channel },
  }));
}

export function updateMessage(channelId: string, message: Message) {
  cache.setState((state) => ({
    messages: {
      ...state.messages,
      [channelId]: {
        ...state.messages[channelId],
        [message.id]: message as CachedMessage,
      },
    },
  }));
}

export function updateAuthor(author: Author) {
  cache.setState((state) => ({
    authors: { ...state.authors, [author.id]: author },
  }));
}

export function useUser() {
  return cache(useShallow((state) => state.user));
}

export function useChannels() {
  return cache(useShallow((state) => state.channels));
}

export function useChannel(channelId: string) {
  const channels = useChannels();
  return channels[channelId];
}

export function useMessages() {
  return cache(useShallow((state) => state.messages));
}

export function useChannelMessages(channelId: string) {
  return cache(useShallow((state) => state.messages[channelId]));
}

export function useChannelMessage(channelId: string, messageId: string) {
  return cache(useShallow((state) => state.messages[channelId][messageId]));
}

export function useAuthor(authorId: string) {
  return cache(useShallow((state) => state.authors[authorId]));
}

export function useAuthors() {
  return cache(useShallow((state) => state.authors));
}

export function useLastEventTs() {
  return cache(useShallow((state) => state.last_event_ts));
}
