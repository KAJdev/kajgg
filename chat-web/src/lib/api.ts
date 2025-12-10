import type { User } from "@schemas/models/user";
import {
  addAuthor,
  addChannel,
  addMessage,
  removeMessage,
  setUser,
  updateMessage,
} from "./cache";
import type { Channel } from "@schemas/models/channel";
import type { Message } from "@schemas/models/message";
import { request } from "./request";
import type { Author } from "@schemas/models/author";

export async function login(username: string, password: string) {
  const [user, error] = await request<User>("login", {
    method: "POST",
    body: { username, password },
  });

  if (error) {
    throw error;
  }

  setUser(user);
  return user;
}

export async function signup(
  username: string,
  password: string,
  email: string
) {
  const [user, error] = await request<User>("signup", {
    method: "POST",
    body: { username, password, email },
  });

  if (error) {
    throw error;
  }

  setUser(user);
  return user;
}

export async function createChannel(
  name: string,
  topic: string,
  isPrivate: boolean
) {
  const [channel, error] = await request<Channel>("channels", {
    method: "POST",
    body: { name, topic, private: isPrivate },
  });

  if (error) {
    throw error;
  }

  addChannel(channel);
  return channel;
}

export async function fetchChannels() {
  const [channels, error] = await request<Channel[]>("channels");

  if (error) {
    throw error;
  }

  for (const channel of channels) {
    addChannel(channel);
  }

  return channels;
}

export async function createMessage(channelId: string, content: string) {
  if (content.length === 0) {
    return;
  }

  const [message, error] = await request<Message>(
    `channels/${channelId}/messages`,
    {
      method: "POST",
      body: { content },
    }
  );

  if (error) {
    throw error;
  }

  addMessage(channelId, message);

  return message;
}

export async function editMessage(
  channelId: string,
  messageId: string,
  content: string
) {
  const [message, error] = await request<Message>(
    `channels/${channelId}/messages/${messageId}`,
    {
      method: "PATCH",
      body: { content },
    }
  );

  if (error) {
    throw error;
  }

  updateMessage(channelId, message);

  return message;
}

export async function deleteMessage(channelId: string, messageId: string) {
  const [message, error] = await request<Message>(
    `channels/${channelId}/messages/${messageId}`,
    {
      method: "DELETE",
    }
  );

  if (error) {
    throw error;
  }

  removeMessage(channelId, messageId);

  return message;
}

export async function fetchMessages(
  channelId: string,
  after?: Date,
  before?: Date,
  limit?: number,
  authorId?: string,
  contains?: string
) {
  const [messages, error] = await request<Message[]>(
    `channels/${channelId}/messages`,
    {
      method: "GET",
      args: {
        after: after?.toISOString(),
        before: before?.toISOString(),
        limit: limit?.toString(),
        author_id: authorId,
        contains,
      },
    }
  );

  if (error) {
    throw error;
  }

  for (const message of messages) {
    addMessage(channelId, message);
  }

  return messages;
}

export async function fetchAuthor(userId: string) {
  const [author, error] = await request<Author>(`users/${userId}`);

  if (error) {
    throw error;
  }

  addAuthor(author);

  return author;
}

export async function fetchMe() {
  const [user, error] = await request<User>("users/@me");

  if (error) {
    throw error;
  }

  setUser(user);
  return user;
}
