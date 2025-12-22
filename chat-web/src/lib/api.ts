import type { User } from "@schemas/models/user";
import {
  addOptimisticMessage,
  addAuthor,
  addChannel,
  addMessages,
  cache,
  prependMessages,
  removeMessage,
  setUser,
  updateAuthor,
  updateMessage,
  updateMessageById,
  setEmojis,
  addWebhook,
  removeWebhook,
  addAuthors,
  setChannelInvites,
  addChannelInvite,
  removeChannelInvite,
} from "./cache";
import type { Channel } from "@schemas/models/channel";
import type { Message } from "@schemas/models/message";
import { request } from "./request";
import type { Author } from "@schemas/models/author";
import type { FileUpload } from "@schemas/models/fileupload";
import type { File as ApiFile } from "@schemas/models/file";
import type { User as UserType } from "src/types/models/user";
import type { ChannelInvite, Emoji, Webhook } from "@schemas/index";
import { useShallow } from "zustand/react/shallow";

async function compressImage(file: File): Promise<File> {
  const compressed = await new Promise<File>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      const blob = new Blob([dataUrl], { type: "image/png" });
      resolve(new File([blob], file.name, { type: "image/png" }));
    };
    img.onerror = () => reject(new Error("failed to compress image"));
    img.src = URL.createObjectURL(file);
  });
  return compressed;
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () =>
      reject(reader.error ?? new Error("failed to read file"));

    // we want to compress the image if its greater than 1MB
    if (file.size > 1000000 && file.type.startsWith("image/")) {
      compressImage(file)
        .then((compressed) => {
          reader.readAsDataURL(compressed);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      reader.readAsDataURL(file);
    }
  });
}

export async function updateAvatar(image: string | File | null) {
  if (image === null) {
    const [updatedUser, error] = await request<User>("users/@me/avatar", {
      method: "DELETE",
    });
    if (error) throw error;
    setUser(updatedUser);
    updateAuthor(updatedUser);
    return updatedUser;
  }

  const imageData = image instanceof File ? await fileToDataUrl(image) : image;

  const [updatedUser, error] = await request<User>("users/@me/avatar", {
    method: "POST",
    body: { image: imageData },
  });

  if (error) {
    throw error;
  }

  setUser(updatedUser);
  updateAuthor(updatedUser);
  return updatedUser;
}

export async function login(username: string, password: string) {
  return await request<User>("login", {
    method: "POST",
    body: { username, password },
  });
}

export async function signup(
  username: string,
  password: string,
  email: string
) {
  return await request<User>("signup", {
    method: "POST",
    body: { username, password, email },
  });
}

export async function updateUser(user: Partial<UserType>) {
  const [updatedUser, error] = await request<User>("users/@me", {
    method: "PATCH",
    body: user,
  });

  if (error) {
    return [null, error] as const;
  }

  setUser(updatedUser);
  updateAuthor(updatedUser);
  return [updatedUser, null] as const;
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

  const localPreviewBySig = new Map<string, string>();
  for (const lf of localFiles) {
    localPreviewBySig.set(`${lf.name}:${lf.size}:${lf.mime_type}`, lf.url);
  }

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
    // throttle progress writes so we don't rerender 60x/sec during big uploads
    const lastProgressByFileId = new Map<string, number>();
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
          uploads.map((u, i) => {
            const sig = `${u.file.name}:${u.file.size}:${u.file.mime_type}`;
            const preview =
              localPreviewBySig.get(sig) ?? localFiles[i]?.url ?? undefined;
            return [u.file.id, { progress: 0, preview_url: preview }];
          })
        ),
      },
    });

    await Promise.all(
      uploads.map((u, i) =>
        uploadWithProgress(u.upload_url, u.method ?? "PUT", files[i], (p) => {
          const last = lastProgressByFileId.get(u.file.id) ?? -1;
          if (p !== 1 && p - last < 0.01) return;
          lastProgressByFileId.set(u.file.id, p);

          const current =
            cache.getState().messages[channelId]?.[optimisticId]?.client
              ?.uploads ?? {};
          const prev = current[u.file.id];
          updateMessageById(channelId, optimisticId, {
            client: {
              status: "sending",
              uploads: {
                ...current,
                [u.file.id]: {
                  ...(prev ? { ...prev, progress: p } : { progress: p }),
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

export async function editChannel(
  channelId: string,
  channel: Partial<Channel>
) {
  return await request<Channel>(`channels/${channelId}`, {
    method: "PATCH",
    body: channel,
  });
}

export async function deleteChannel(channelId: string) {
  const [, error] = await request<Channel>(`channels/${channelId}`, {
    method: "DELETE",
  });

  if (error) {
    throw error;
  }
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
  contains?: string,
  options?: { mode?: "append" | "prepend" }
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

  if (options?.mode === "prepend") {
    prependMessages(channelId, messages);
  } else {
    addMessages(channelId, messages);
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

export async function fetchEmojis(userId?: string) {
  const [emojis, error] = await request<Emoji[]>(
    `users/${userId ?? "@me"}/emojis`
  );
  if (error) {
    throw error;
  }
  setEmojis(emojis);
  return emojis;
}

export async function createEmoji(name: string, image: string | File) {
  let imageData: string;
  if (image instanceof File) {
    imageData = await fileToDataUrl(image);
  } else {
    imageData = image;
  }

  let sanitizedName = name.toLowerCase().replaceAll(/[^a-z0-9_-]/g, "");
  if (sanitizedName.length < 3 || sanitizedName.length > 32) {
    sanitizedName = "emoji";
  }
  if (
    Object.values(cache.getState().emojis).some(
      (emoji) => emoji.name === sanitizedName
    )
  ) {
    sanitizedName = `${sanitizedName}_${Math.floor(Math.random() * 1000000)}`;
  }

  const [emoji, error] = await request<Emoji>(`users/@me/emojis`, {
    method: "POST",
    body: { name: sanitizedName, image: imageData },
  });
  if (error) {
    throw error;
  }
  setEmojis([...Object.values(cache.getState().emojis), emoji]);
  return emoji;
}

export async function deleteEmoji(emojiId: string) {
  const [, error] = await request<Emoji>(`users/@me/emojis/${emojiId}`, {
    method: "DELETE",
  });
  if (error) {
    throw error;
  }
  setEmojis(
    Object.values(cache.getState().emojis).filter(
      (emoji) => emoji.id !== emojiId
    )
  );
}

export async function updateEmoji(emojiId: string, name: string) {
  let sanitizedName = name.toLowerCase().replaceAll(/[^a-z0-9_-]/g, "");
  if (sanitizedName.length < 3 || sanitizedName.length > 32) {
    sanitizedName = "emoji";
  }
  if (
    Object.values(cache.getState().emojis).some(
      (emoji) => emoji.name === sanitizedName
    )
  ) {
    sanitizedName = `${sanitizedName}_${Math.floor(Math.random() * 1000000)}`;
  }
  const [emoji, error] = await request<Emoji>(`users/@me/emojis/${emojiId}`, {
    method: "PATCH",
    body: { name: sanitizedName },
  });
  if (error) {
    throw error;
  }
  setEmojis(
    Object.values(cache.getState().emojis).map((e) =>
      e.id === emojiId ? emoji : e
    )
  );
  return emoji;
}

export function useWebhooks(channelId: string) {
  return cache(useShallow((state) => state.webhooks[channelId] ?? []));
}

export async function createWebhook(channelId: string, name: string) {
  const [webhook, error] = await request<Webhook>(
    `channels/${channelId}/webhooks`,
    {
      method: "POST",
      body: { name },
    }
  );
  if (error) {
    throw error;
  }
  addWebhook(webhook);
  return webhook;
}

export async function deleteWebhook(channelId: string, webhookId: string) {
  const [, error] = await request<Webhook>(
    `channels/${channelId}/webhooks/${webhookId}`,
    {
      method: "DELETE",
    }
  );
  if (error) {
    throw error;
  }
  removeWebhook(channelId, webhookId);
}

export async function updateWebhook(
  channelId: string,
  webhookId: string,
  webhook: Partial<Webhook>
) {
  const [updatedWebhook, error] = await request<Webhook>(
    `channels/${channelId}/webhooks/${webhookId}`,
    {
      method: "PATCH",
      body: webhook,
    }
  );
  if (error) {
    throw error;
  }
  addWebhook(updatedWebhook);
  return updatedWebhook;
}

export async function fetchWebhooks(channelId: string) {
  const [webhooks, error] = await request<Webhook[]>(
    `channels/${channelId}/webhooks`
  );
  if (error) {
    throw error;
  }
  for (const webhook of webhooks) {
    addWebhook(webhook);
  }
  return webhooks;
}

export async function fetchChannelMembers(channelId: string) {
  const [members, error] = await request<Author[]>(
    `channels/${channelId}/members`
  );
  if (error) {
    throw error;
  }
  addAuthors(members);
  cache.setState((state) => ({
    channelMembers: {
      ...state.channelMembers,
      [channelId]: members.map((member) => member.id),
    },
  }));
  return members;
}

export async function fetchChannelInvites(channelId: string) {
  const [invites, error] = await request<ChannelInvite[]>(
    `channels/${channelId}/invites`
  );
  if (error) {
    throw error;
  }
  setChannelInvites(channelId, invites);
  return invites;
}

export async function createChannelInvite(
  channelId: string,
  expiresAt?: Date,
  usesLeft?: number
) {
  const [invite, error] = await request<ChannelInvite>(
    `channels/${channelId}/invites`,
    {
      method: "POST",
      body: { expires_at: expiresAt?.toISOString(), uses_left: usesLeft },
    }
  );
  if (error) {
    throw error;
  }
  addChannelInvite(channelId, invite);
  return invite;
}

export async function deleteChannelInvite(channelId: string, inviteId: string) {
  const [, error] = await request<ChannelInvite>(
    `channels/${channelId}/invites/${inviteId}`,
    {
      method: "DELETE",
    }
  );
  if (error) {
    throw error;
  }
  removeChannelInvite(channelId, inviteId);
}

export async function fetchInvite(code: string) {
  const [invite, error] = await request<{
    invite: ChannelInvite;
    channel: Channel;
    author: Author;
  }>(`invites/${code}`);
  if (error) {
    throw error;
  }
  return invite;
}

export async function joinInvite(code: string) {
  const [response, error] = await request<{ success: boolean }>(
    `invites/${code}/join`,
    {
      method: "POST",
    }
  );
  if (error) {
    throw error;
  }
  return response;
}
