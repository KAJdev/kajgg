import type { Author } from "@schemas/models/author";
import type { Channel } from "@schemas/models/channel";
import type { Message } from "@schemas/models/message";
import type { User } from "@schemas/models/user";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/shallow";
import { flipColor, getIsPageFocused } from "./utils";

type TimeoutId = ReturnType<typeof setTimeout>;

// keep more so infinite scroll doesn't immediately evict history
const MAX_MESSAGES_PER_CHANNEL = 2000;

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
  cachedAt?: number;
};

type ChannelMessageQueue = {
  ids: string[];
  head: number;
};

export type Cache = {
  user?: User;
  channels: Record<string, Channel>;
  messages: Record<string, Record<string, CachedMessage>>;
  messageQueues: Record<string, ChannelMessageQueue>;
  authors: Record<string, Author>;
  typing: Record<string, Record<string, TimeoutId>>;
  last_event_ts?: number;
};

export type PersistentCache = {
  lastSeenChannel: string | null;
  lastSeenChannelAt: Record<string, number>; // channel id -> timestamp
  userSettings: {
    theme: {
      colors: {
        background: string;
        primary: string;
        secondary: string;
        tertiary: string;
      };
    };
  };
};

export const cache = create<Cache>()(() => ({
  user: undefined,
  channels: {},
  messages: {},
  messageQueues: {},
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

export const defaultTheme = {
  background: "#101010",
  primary: "#d3f9d8",
  secondary: "#a3a3a3",
  tertiary: "#3f3f3f",
};

export const persistentCache = create<PersistentCache>()(
  persist(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_set) => ({
      lastSeenChannel: null,
      lastSeenChannelAt: {},
      userSettings: {
        theme: {
          colors: defaultTheme,
        },
      },
    }),
    {
      name: "persistent",
    }
  )
);

export function useAppliedTheme() {
  const theme = persistentCache(
    useShallow((state) => state.userSettings.theme)
  );

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--color-background",
      theme.colors.background
    );
    document.documentElement.style.setProperty(
      "--color-primary",
      theme.colors.primary
    );
    document.documentElement.style.setProperty(
      "--color-secondary",
      theme.colors.secondary
    );
    document.documentElement.style.setProperty(
      "--color-tertiary",
      theme.colors.tertiary
    );
  }, [theme]);
}

export function useUserSettings() {
  const settings = persistentCache(useShallow((state) => state.userSettings));

  return {
    theme: settings.theme,
    resetColor: (color: keyof typeof defaultTheme) => {
      persistentCache.setState((state) => ({
        userSettings: {
          ...state.userSettings,
          theme: {
            ...state.userSettings.theme,
            colors: {
              ...state.userSettings.theme.colors,
              [color]: defaultTheme[color],
            },
          },
        },
      }));
    },
    setThemeColor: (
      color: keyof typeof settings.theme.colors,
      value: string
    ) => {
      persistentCache.setState({
        userSettings: {
          ...settings,
          theme: {
            ...settings.theme,
            colors: { ...settings.theme.colors, [color]: value },
          },
        },
      });
    },
  } as const;
}

export function useFlippedColors(backgroundColor: string) {
  // returns the theme colors, but flipped if the color is too light
  const r = parseInt(backgroundColor.slice(1, 3), 16);
  const g = parseInt(backgroundColor.slice(3, 5), 16);
  const b = parseInt(backgroundColor.slice(5, 7), 16);
  const shouldFlip = r * 0.299 + g * 0.587 + b * 0.114 > 146;

  const theme = persistentCache(
    useShallow((state) => state.userSettings.theme)
  );
  if (shouldFlip) {
    return Object.fromEntries(
      Object.entries(theme.colors).map(([key, color]) => [
        key,
        flipColor(color),
      ])
    );
  }
  return theme.colors;
}

export function setUser(user: User) {
  cache.setState({ user });
  if (user.token) {
    tokenCache.setState({ token: user.token });
  }
}

export function setLastSeenChannel(channelId: string) {
  persistentCache.setState({ lastSeenChannel: channelId });
}

export function setLastSeenChannelAt(channelId: string, timestamp: number) {
  persistentCache.setState({
    lastSeenChannelAt: {
      ...persistentCache.getState().lastSeenChannelAt,
      [channelId]: timestamp,
    },
  });
}

export function useLastSeenChannelAt(channelId: string) {
  return persistentCache(
    useShallow((state) => state.lastSeenChannelAt[channelId])
  );
}

export function useIsChannelUnread(channelId: string) {
  const channel = cache(useShallow((state) => state.channels[channelId]));
  const lastSeenChannelAt = persistentCache(
    useShallow((state) => state.lastSeenChannelAt[channelId])
  );
  if (!channel) {
    return false;
  }
  if (!lastSeenChannelAt) {
    return true;
  }
  return (
    channel.last_message_at &&
    new Date(channel.last_message_at).getTime() > lastSeenChannelAt
  );
}

export function updateChannelLastMessageAt(channelId: string, timestamp: Date) {
  cache.setState((state) => ({
    channels: {
      ...state.channels,
      [channelId]: { ...state.channels[channelId], last_message_at: timestamp },
    },
  }));
}

export function getLastSeenChannel() {
  return persistentCache.getState().lastSeenChannel;
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

function _upsertQueuedMessage(
  state: Cache,
  channelId: string,
  messageId: string,
  nextMessage: CachedMessage
) {
  const currentChannel = state.messages[channelId] ?? {};
  const alreadyHad = !!currentChannel[messageId];

  const nextChannel: Record<string, CachedMessage> = {
    ...currentChannel,
    [messageId]: {
      ...nextMessage,
      cachedAt: alreadyHad ? currentChannel[messageId]?.cachedAt : Date.now(),
    },
  };

  // note: we used to evict by arrival order, but that breaks once you page in older messages.
  // this keeps memory bounded while preserving newest-by-created_at.
  if (Object.keys(nextChannel).length > MAX_MESSAGES_PER_CHANNEL) {
    const sorted = Object.values(nextChannel).sort((a, b) => {
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      return at - bt;
    });
    const toEvict = sorted.length - MAX_MESSAGES_PER_CHANNEL;
    for (let i = 0; i < toEvict; i++) {
      const id = sorted[i]?.id;
      if (id) delete nextChannel[id];
    }
  }

  // keep the queue around for backwards compat / persistence but rebuild it from current keys
  // (otherwise it grows without bound once we stop using arrival-order eviction)
  const qIds = Object.keys(nextChannel);
  const qHead = 0;

  return {
    messages: {
      ...state.messages,
      [channelId]: nextChannel,
    },
    messageQueues: {
      ...state.messageQueues,
      [channelId]: { ids: qIds, head: qHead },
    },
  };
}

export function addMessage(channelId: string, message: Message) {
  cache.setState((state) => {
    return _upsertQueuedMessage(
      state,
      channelId,
      message.id,
      message as CachedMessage
    );
  });

  if (message.author_id !== cache.getState().user?.id && !getIsPageFocused()) {
    updateChannelLastMessageAt(channelId, message.created_at);
  }
}

export function addOptimisticMessage(
  channelId: string,
  message: CachedMessage
) {
  cache.setState((state) => {
    return _upsertQueuedMessage(state, channelId, message.id, message);
  });
}

export function updateMessageById(
  channelId: string,
  messageId: string,
  patch: Partial<CachedMessage>
) {
  cache.setState((state) => {
    const currentChannel = state.messages[channelId] ?? {};
    const existing = currentChannel[messageId];

    return _upsertQueuedMessage(state, channelId, messageId, {
      ...(existing as CachedMessage),
      ...patch,
      cachedAt: existing?.cachedAt ?? Date.now(),
    });
  });
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
    ...serverMessage,
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

  if (author.id === cache.getState().user?.id) {
    const user = { ...cache.getState().user };
    for (const key in author) {
      if (key in user) {
        // @ts-expect-error - author is a subset of user
        user[key] = author[key];
      }
    }
    setUser(user as User);
  }
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
  cache.setState((state) => {
    return _upsertQueuedMessage(
      state,
      channelId,
      message.id,
      message as CachedMessage
    );
  });
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
