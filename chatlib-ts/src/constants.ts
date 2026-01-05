export const Events = {
  ClientReady: "clientReady",

  MessageCreated: "MESSAGE_CREATED",
  MessageUpdated: "MESSAGE_UPDATED",
  MessageDeleted: "MESSAGE_DELETED",

  ChannelCreated: "CHANNEL_CREATED",
  ChannelUpdated: "CHANNEL_UPDATED",
  ChannelDeleted: "CHANNEL_DELETED",

  AuthorUpdated: "AUTHOR_UPDATED",
  TypingStarted: "TYPING_STARTED",
} as const;

export type Events = (typeof Events)[keyof typeof Events];
