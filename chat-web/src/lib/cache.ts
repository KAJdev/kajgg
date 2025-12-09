import type { Author } from "@schemas/models/author";
import type { Channel } from "@schemas/models/channel";
import type { Message } from "@schemas/models/message";
import type { User } from "@schemas/models/user";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/shallow";

export type Cache = {
  user?: User;
  channels: Record<string, Channel>;
  messages: Record<string, Record<string, Message>>;
  authors: Record<string, Author>;
  last_event_ts?: number;
};

export const cache = create<Cache>()(() => ({
  user: undefined,
  channels: {},
  messages: {},
  authors: {},
  last_event_ts: undefined,
}));

export const tokenCache = create<{ token?: string }>()(
  persist(
    (set) => ({
      token: undefined,
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

export function setLastEventTs(last_event_ts: number) {
  cache.setState({ last_event_ts });
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
      [channelId]: { ...state.messages[channelId], [message.id]: message },
    },
  }));
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
      [channelId]: { ...state.messages[channelId], [message.id]: message },
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
