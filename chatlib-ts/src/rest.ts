import { getFetch } from "./internal/fetch";
import type { Message, User } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`${status}: ${message}`);
    this.status = status;
  }
}

export type RestOptions = {
  baseUrl: string;
  token?: string | null;
};

export class Rest {
  baseUrl: string;
  token: string | null;

  constructor(opts: RestOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token ?? null;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private apiUrl(path: string, version: "v1" = "v1") {
    const clean = path.replace(/^\//, "");
    return `${this.baseUrl}/api/${version}/${clean}`;
  }

  async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    const fetchImpl = getFetch();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "kajgg-client/0.1.0",
    };
    if (this.token) headers.Authorization = this.token;

    const resp = await fetchImpl(this.apiUrl(path), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data: any = null;
    try {
      data = await resp.json();
    } catch {
      data = null;
    }

    if (!resp.ok) {
      const msg =
        typeof data?.message === "string" ? data.message : resp.statusText;
      throw new ApiError(resp.status, msg || "request failed");
    }

    return data as T;
  }

  async login(username: string, password: string): Promise<User> {
    return await this.request<User>("POST", "login", { username, password });
  }

  async sendMessage(channelId: string, content: string): Promise<Message> {
    return await this.request<Message>(
      "POST",
      `channels/${channelId}/messages`,
      { content: content.trim() }
    );
  }
}
