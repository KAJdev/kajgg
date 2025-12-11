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
import type { FileUpload } from "@schemas/models/fileupload";
import type { File as ApiFile } from "@schemas/models/file";
import { cache, addOptimisticMessage, updateMessageById } from "./cache";

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

export async function createMessage(
  channelId: string,
  content: string,
  files?: File[]
) {
  const trimmed = content.trim();
  const hasFiles = (files?.length ?? 0) > 0;

  if (trimmed.length === 0 && !hasFiles) {
    return;
  }

  const nonce =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const optimisticId = `nonce:${nonce}`;

  const userId = cache.getState().user?.id ?? "me";
  const createdAt = new Date();

  const localFiles: ApiFile[] = (files ?? []).map((f, i) => ({
    id: `local:${i}-${f.name}-${f.size}`,
    name: f.name,
    mime_type: f.type || "application/octet-stream",
    size: f.size,
    // local object url so previews work before r2 finishes
    url: URL.createObjectURL(f),
  }));

  // show the message immediately, with client-only metadata
  addOptimisticMessage(channelId, {
    id: optimisticId,
    nonce,
    // types are generated; keep this value aligned with MessageType enum
    type: "default" as Message["type"],
    content: trimmed.length ? trimmed : undefined,
    files: localFiles,
    created_at: createdAt,
    author_id: userId,
    channel_id: channelId,
    client: {
      status: "sending",
      uploads: Object.fromEntries(
        localFiles.map((lf) => [lf.id, { progress: 0, preview_url: lf.url }])
      ),
    },
  });

  const uploadWithProgress = (
    uploadUrl: string,
    method: string,
    file: File,
    onProgress: (p: number) => void
  ) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method || "PUT", uploadUrl, true);
      xhr.setRequestHeader(
        "Content-Type",
        file.type || "application/octet-stream"
      );

      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        onProgress(evt.total ? evt.loaded / evt.total : 0);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        reject(new Error(`upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("upload failed"));
      xhr.send(file);
    });

  let fileIds: string[] = [];

  if (hasFiles && files) {
    const [uploads, presignError] = await request<FileUpload[]>(
      "files/presign",
      {
        method: "POST",
        body: {
          files: files.map((f) => ({
            name: f.name,
            mime_type: f.type || "application/octet-stream",
            size: f.size,
          })),
        },
      }
    );

    if (presignError) {
      updateMessageById(channelId, optimisticId, {
        client: { status: "failed", error: presignError.message },
      });
      throw presignError;
    }

    // swap local file list to server-side file metadata (real ids + final urls)
    updateMessageById(channelId, optimisticId, {
      files: uploads.map((u) => u.file),
      client: {
        status: "sending",
        uploads: Object.fromEntries(
          uploads.map((u, i) => [
            u.file.id,
            { progress: 0, preview_url: localFiles[i]?.url },
          ])
        ),
      },
    });

    await Promise.all(
      uploads.map((u, i) =>
        uploadWithProgress(u.upload_url, u.method ?? "PUT", files[i], (p) => {
          const current =
            cache.getState().messages[channelId]?.[optimisticId]?.client
              ?.uploads ?? {};
          updateMessageById(channelId, optimisticId, {
            client: {
              status: "sending",
              uploads: {
                ...current,
                [u.file.id]: {
                  ...(current[u.file.id] ?? {}),
                  progress: p,
                },
              },
            },
          });
        })
      )
    );

    fileIds = uploads.map((u) => u.file.id);

    const [, completeError] = await request<ApiFile[]>("files/complete", {
      method: "POST",
      body: { file_ids: fileIds },
    });

    if (completeError) {
      updateMessageById(channelId, optimisticId, {
        client: { status: "failed", error: completeError.message },
      });
      throw completeError;
    }
  }

  const [message, error] = await request<Message>(
    `channels/${channelId}/messages`,
    {
      method: "POST",
      body: {
        content: trimmed.length ? trimmed : undefined,
        file_ids: fileIds,
        nonce,
      },
    }
  );

  if (error) {
    updateMessageById(channelId, optimisticId, {
      client: { status: "failed", error: error.message },
    });
    throw error;
  }

  // replace optimistic message with server message (gateway also reconciles by nonce)
  removeMessage(channelId, optimisticId);
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

export async function startTyping(channelId: string) {
  const [response, error] = await request<{ success: boolean }>(
    `channels/${channelId}/typing`,
    {
      method: "POST",
    }
  );

  if (error) {
    throw error;
  }

  return response;
}
