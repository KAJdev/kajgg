/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Author } from "@schemas/models/author";
import type { Channel } from "@schemas/models/channel";
import type { Message } from "@schemas/models/message";
import type { User } from "@schemas/models/user";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/shallow";
import { flipColor, getIsPageFocused } from "./utils";
import type { ChannelInvite, Emoji, Webhook } from "@schemas/index";
import { fetchChannelInvites, fetchChannelMembers } from "./api";

type TimeoutId = ReturnType<typeof setTimeout>;

const MAX_MESSAGES_PER_CHANNEL = 200;
const EVICT_NEAR_BOTTOM_THRESHOLD_PX = 2000;

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

type ChannelMessageBounds = {
  oldest: Date;
  newest: Date;
};

function _compute_bounds(
  channel: Record<string, CachedMessage>
): ChannelMessageBounds | undefined {
  const vals = Object.values(channel);
  if (!vals.length) return undefined;

  let oldest = vals[0];
  let newest = vals[0];
  const oldestTs = () => new Date(oldest.created_at).getTime();
  const newestTs = () => new Date(newest.created_at).getTime();

  for (const m of vals) {
    const ts = new Date(m.created_at).getTime();
    if (ts < oldestTs()) oldest = m;
    if (ts > newestTs()) newest = m;
  }

  return {
    oldest: new Date(oldest.created_at),
    newest: new Date(newest.created_at),
  };
}

export type Cache = {
  user?: User;
  channels: Record<string, Channel>;
  messages: Record<string, Record<string, CachedMessage>>;
  messageBounds: Record<string, ChannelMessageBounds>;
  channelAtBottom: Record<string, boolean>;
  channelDistFromBottom: Record<string, number>;
  authors: Record<string, Author>;
  channelMembers: Record<string, string[]>; // channel id -> member ids
  typing: Record<string, Record<string, TimeoutId>>;
  last_event_ts?: number;
  emojis: Record<string, Emoji>;
  webhooks: Record<string, Webhook[]>;
  channelInvites: Record<string, ChannelInvite[]>;
};

const _toMs = (d: Date | string | null | undefined) =>
  d ? new Date(d).getTime() : null;

function _bumpChannelLastMessageAtInState(
  state: Cache,
  channelId: string,
  createdAt: Date
) {
  const existing = state.channels[channelId];
  if (!existing) return state;

  const prev = _toMs(existing.last_message_at);
  const next = createdAt.getTime();
  if (prev !== null && next <= prev) return state;

  return {
    ...state,
    channels: {
      ...state.channels,
      [channelId]: { ...existing, last_message_at: createdAt },
    },
  };
}

function _hasGapToNewest(state: Cache, channelId: string) {
  const boundsNewest = state.messageBounds[channelId]?.newest;
  const channelLast = state.channels[channelId]?.last_message_at;
  const boundsNewestTs = _toMs(boundsNewest);
  const channelLastTs = _toMs(channelLast);
  return boundsNewestTs !== null && channelLastTs !== null
    ? channelLastTs > boundsNewestTs
    : false;
}

function _shouldDropRealtimeInsert(
  state: Cache,
  channelId: string,
  message: Message,
  mode: "add" | "update"
) {
  // only drop for true realtime inserts (not updates), and never for your own sends
  if (mode !== "add") return false;
  if (message.author_id === state.user?.id) return false;
  return _hasGapToNewest(state, channelId);
}

function _mergeQueuedMessages(
  base: Record<string, CachedMessage>,
  nextMessages: CachedMessage[]
) {
  const nextChannel: Record<string, CachedMessage> = { ...base };

  for (const nextMessage of nextMessages) {
    const messageId = nextMessage.id;
    const existing = nextChannel[messageId];

    // keep cachedat stable so ui stuff (like animations) doesn't freak out
    const cachedAt = existing?.cachedAt ?? Date.now();

    const merged: CachedMessage = {
      ...(existing ?? ({} as CachedMessage)),
      ...nextMessage,
      cachedAt,
    };

    // don't let undefined from server stomp client-only metadata
    if (nextMessage.client === undefined && existing?.client !== undefined) {
      merged.client = existing.client;
    }

    nextChannel[messageId] = merged;
  }

  return nextChannel;
}

function _evictOverCapacity(
  state: Cache,
  channelId: string,
  channel: Record<string, CachedMessage>,
  mode: "append" | "prepend" | "single"
) {
  const over = Object.keys(channel).length - MAX_MESSAGES_PER_CHANNEL;
  if (over <= 0) return channel;

  const distFromBottom = state.channelDistFromBottom[channelId] ?? 0;
  const nearBottom = distFromBottom <= EVICT_NEAR_BOTTOM_THRESHOLD_PX;
  const sorted = Object.values(channel).sort((a, b) => {
    const at = new Date(a.created_at).getTime();
    const bt = new Date(b.created_at).getTime();
    if (at !== bt) return at - bt;
    return a.id.localeCompare(b.id);
  });

  // if user is reading history (not at bottom), never evict from the top (oldest),
  // because that collapses content above the viewport and makes scroll jump to start
  //
  // - prepend: we pulled older history => drop newest
  // - append/single:
  //    - near bottom => drop oldest (avoid clamping scrolltop when bottom shrinks)
  //    - far from bottom => drop newest (don't delete what they're reading)
  const dropNewest = mode === "prepend" || !nearBottom;

  const nextChannel: Record<string, CachedMessage> = { ...channel };
  if (dropNewest) {
    for (let i = 0; i < over; i++) {
      const id = sorted[sorted.length - 1 - i]?.id;
      if (id) delete nextChannel[id];
    }
  } else {
    for (let i = 0; i < over; i++) {
      const id = sorted[i]?.id;
      if (id) delete nextChannel[id];
    }
  }

  return nextChannel;
}

function _messagesAndBoundsPatch(
  state: Cache,
  channelId: string,
  channel: Record<string, CachedMessage>
) {
  // track bounds so the ui can decide if it should fetch forward/backward pages
  const bounds = _compute_bounds(channel);
  return {
    messages: {
      ...state.messages,
      [channelId]: channel,
    },
    messageBounds: {
      ...state.messageBounds,
      ...(bounds ? { [channelId]: bounds } : {}),
    },
  } satisfies Pick<Cache, "messages" | "messageBounds">;
}

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
  messageBounds: {},
  channelAtBottom: {},
  channelDistFromBottom: {},
  authors: {},
  channelMembers: {},
  typing: {},
  last_event_ts: undefined,
  emojis: {},
  webhooks: {},
  channelInvites: {},
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
  const r = Number.parseInt(backgroundColor.slice(1, 3), 16);
  const g = Number.parseInt(backgroundColor.slice(3, 5), 16);
  const b = Number.parseInt(backgroundColor.slice(5, 7), 16);
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

export function markChannelAsRead(channelId: string) {
  persistentCache.setState({
    lastSeenChannelAt: {
      ...persistentCache.getState().lastSeenChannelAt,
      [channelId]: Date.now(),
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

export function useChannelMembers(channelId: string) {
  const memberIds = cache(
    useShallow((state) => state.channelMembers[channelId])
  );
  const members = useAuthors();
  const user = useUser();
  const channel = useChannel(channelId);

  useEffect(() => {
    if (!memberIds && channel?.private) {
      void fetchChannelMembers(channelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  if (channel?.private) {
    const filteredMembers = Object.values(members).filter(
      (member) => memberIds?.includes(member.id) ?? false
    );
    if (user) {
      filteredMembers.push(user);
    }
    return filteredMembers;
  }

  return members;
}

export function addChannelMember(channelId: string, userId: string) {
  cache.setState((state) => ({
    channelMembers: {
      ...state.channelMembers,
      [channelId]: [...(state.channelMembers[channelId] ?? []), userId],
    },
  }));
}

export function removeChannelMember(channelId: string, userId: string) {
  cache.setState((state) => ({
    channelMembers: {
      ...state.channelMembers,
      [channelId]:
        state.channelMembers[channelId]?.filter((id) => id !== userId) ?? [],
    },
  }));
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

function _upsertQueuedMessages(
  state: Cache,
  channelId: string,
  nextMessages: CachedMessage[],
  mode: "append" | "prepend" | "single" = "append"
) {
  const currentChannel = state.messages[channelId] ?? {};
  const merged = _mergeQueuedMessages(currentChannel, nextMessages);
  const evicted = _evictOverCapacity(state, channelId, merged, mode);
  return _messagesAndBoundsPatch(state, channelId, evicted);
}

function _upsertQueuedMessage(
  state: Cache,
  channelId: string,
  messageId: string,
  nextMessage: CachedMessage
) {
  return _upsertQueuedMessages(
    state,
    channelId,
    [{ ...nextMessage, id: messageId }],
    "single"
  );
}

export function addMessage(channelId: string, message: Message) {
  cache.setState((state) => {
    return _upsertQueuedMessage(state, channelId, message.id, message);
  });

  if (message.author_id !== cache.getState().user?.id) {
    updateChannelLastMessageAt(channelId, message.created_at);
  }
}

export function addMessages(channelId: string, messages: Message[]) {
  cache.setState((state) => {
    return _upsertQueuedMessages(state, channelId, messages, "append");
  });

  if (getIsPageFocused()) return;

  const me = cache.getState().user?.id;
  let latest: Date | null = null;
  for (const message of messages) {
    if (message.author_id === me) continue;
    const ts = new Date(message.created_at);
    if (!latest || ts.getTime() > latest.getTime()) latest = ts;
  }
  if (latest) updateChannelLastMessageAt(channelId, latest);
}

export function prependMessages(channelId: string, messages: Message[]) {
  cache.setState((state) => {
    return _upsertQueuedMessages(state, channelId, messages, "prepend");
  });
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
    if (!existing) return state;

    return _upsertQueuedMessage(state, channelId, messageId, {
      ...existing,
      ...patch,
      cachedAt: existing?.cachedAt ?? Date.now(),
    });
  });
}

export function reconcileMessageByNonce(
  channelId: string,
  serverMessage: Message,
  mode: "add" | "update"
) {
  const nonce = serverMessage.nonce;
  if (!nonce) {
    if (mode === "update") {
      return updateMessageById(channelId, serverMessage.id, serverMessage);
    }

    cache.setState((state) => {
      const createdAt = new Date(serverMessage.created_at);
      const existing = state.messages[channelId]?.[serverMessage.id];

      const bumped = _bumpChannelLastMessageAtInState(
        state,
        channelId,
        createdAt
      );
      const shouldDrop =
        _shouldDropRealtimeInsert(bumped, channelId, serverMessage, mode) &&
        !existing;
      if (shouldDrop) return bumped;

      return _upsertQueuedMessage(
        bumped,
        channelId,
        serverMessage.id,
        serverMessage
      );
    });
    return;
  }

  cache.setState((state) => {
    const createdAt = new Date(serverMessage.created_at);
    const bumped = _bumpChannelLastMessageAtInState(
      state,
      channelId,
      createdAt
    );
    const channel = bumped.messages[channelId] ?? {};

    // find the optimistic entry for this nonce (if any)
    const optimisticId = Object.keys(channel).find(
      (id) => channel[id]?.nonce === nonce
    );

    const optimistic = optimisticId ? channel[optimisticId] : undefined;
    const existingServer = channel[serverMessage.id];

    // no optimistic match => treat like a normal realtime insert/update, with optional drop-when-gap
    if (!optimistic) {
      const shouldDrop =
        _shouldDropRealtimeInsert(bumped, channelId, serverMessage, mode) &&
        !existingServer;
      if (shouldDrop) return bumped;

      return {
        ...bumped,
        ..._upsertQueuedMessage(
          bumped,
          channelId,
          serverMessage.id,
          serverMessage
        ),
      };
    }

    // keep client previews so image/video doesn't flash when swapping blob -> r2 url
    const baseClient = optimistic?.client ?? existingServer?.client;
    const client: ClientMessageMeta | undefined = baseClient
      ? {
          ...baseClient,
          status: "sent",
        }
      : undefined;

    const cachedAt =
      existingServer?.cachedAt ?? optimistic?.cachedAt ?? Date.now();

    const nextChannel: Record<string, CachedMessage> = {
      ...channel,
      [serverMessage.id]: {
        ...(existingServer ?? ({} as CachedMessage)),
        ...serverMessage,
        cachedAt,
        client,
      },
    };

    // nuke optimistic in the same state update so we never show both in one frame
    if (optimisticId && optimisticId !== serverMessage.id) {
      delete nextChannel[optimisticId];
    }

    const evicted = _evictOverCapacity(
      bumped,
      channelId,
      nextChannel,
      "single"
    );
    return {
      ...bumped,
      ..._messagesAndBoundsPatch(bumped, channelId, evicted),
    };
  });
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

export function addAuthors(authors: Author[]) {
  cache.setState((state) => ({
    authors: {
      ...state.authors,
      ...Object.fromEntries(authors.map((author) => [author.id, author])),
    },
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

export function addWebhook(webhook: Webhook) {
  cache.setState((state) => ({
    webhooks: {
      ...state.webhooks,
      [webhook.channel_id]: [
        ...(state.webhooks[webhook.channel_id]?.filter(
          (w) => w.id !== webhook.id
        ) ?? []),
        webhook,
      ],
    },
  }));
}

export function removeWebhook(channelId: string, webhookId: string) {
  cache.setState((state) => ({
    webhooks: {
      ...state.webhooks,
      [channelId]: state.webhooks[channelId].filter((w) => w.id !== webhookId),
    },
  }));
}

export function addChannelInvite(channelId: string, invite: ChannelInvite) {
  cache.setState((state) => ({
    channelInvites: {
      ...state.channelInvites,
      [channelId]: [...(state.channelInvites[channelId] ?? []), invite],
    },
  }));
}

export function removeChannelInvite(channelId: string, inviteId: string) {
  cache.setState((state) => ({
    channelInvites: {
      ...state.channelInvites,
      [channelId]: state.channelInvites[channelId].filter(
        (i) => i.id !== inviteId
      ),
    },
  }));
}

export function useChannelInvites(channelId: string) {
  const invites = cache(useShallow((state) => state.channelInvites[channelId]));

  useEffect(() => {
    if (!invites) void fetchChannelInvites(channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  return invites;
}

export function setChannelInvites(channelId: string, invites: ChannelInvite[]) {
  cache.setState((state) => ({
    channelInvites: {
      ...state.channelInvites,
      [channelId]: invites,
    },
  }));
}

export function updateChannel(channel: Channel) {
  addChannel(channel);
}

export function updateMessage(channelId: string, message: Message) {
  addOptimisticMessage(channelId, message);
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
  return cache(useShallow((state) => state.channels[channelId]));
}

export function useMessages() {
  return cache(useShallow((state) => state.messages));
}

export function useChannelMessages(channelId: string) {
  return cache(useShallow((state) => state.messages[channelId]));
}

export function useChannelMessageBounds(channelId: string) {
  return cache(useShallow((state) => state.messageBounds[channelId]));
}

export function setChannelScrollInfo(
  channelId: string,
  info: { atBottom: boolean; distFromBottom: number }
) {
  cache.setState((state) => {
    const prevAtBottom = state.channelAtBottom[channelId];
    const prevDist = state.channelDistFromBottom[channelId];
    if (prevAtBottom === info.atBottom && prevDist === info.distFromBottom) {
      return state;
    }
    return {
      ...state,
      channelAtBottom: { ...state.channelAtBottom, [channelId]: info.atBottom },
      channelDistFromBottom: {
        ...state.channelDistFromBottom,
        [channelId]: info.distFromBottom,
      },
    };
  });
}

// backwards compat: keep the old name for call sites
export function setChannelAtBottom(channelId: string, atBottom: boolean) {
  setChannelScrollInfo(channelId, {
    atBottom,
    distFromBottom: atBottom ? 0 : Number.POSITIVE_INFINITY,
  });
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

export const contextMenuState = create<{
  position: { x: number; y: number } | null;
  content: React.ReactNode | null;
}>((_set) => ({
  position: null,
  content: null,
}));

export function setContextMenuState(
  position?: { x: number; y: number } | null,
  content?: React.ReactNode | null
) {
  contextMenuState.setState((state) => ({
    ...state,
    position: position === undefined ? state.position : position,
    content: content === undefined ? state.content : content,
  }));
}

export function setEmojis(emojis: Emoji[]) {
  cache.setState({
    emojis: Object.fromEntries(
      emojis.map((emoji) => [emoji.name.toLowerCase(), emoji])
    ),
  });
}

export function useEmojis() {
  return cache(useShallow((state) => state.emojis));
}

export function getEmojiUrl(emojiId: string) {
  return `https://cdn.kaj.gg/emojis/${emojiId}`;
}

export function searchEmojis(query: string) {
  return Object.values(cache.getState().emojis).filter((emoji) =>
    emoji.name.toLowerCase().includes(query.toLowerCase())
  );
}
