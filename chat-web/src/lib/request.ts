import { getToken, tokenCache } from "./cache";

const API_URL = import.meta.env.VITE_API_URL;

export type RequestOptions = {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  args?: Record<string, string | number | boolean | undefined>;
  version?: "v1";
};

export type ApiError = {
  message: string;
  status: number;
};

type Response<T> = [T, null] | [null, ApiError];

export async function request<T>(
  path: string,
  options?: RequestOptions
): Promise<Response<T>> {
  const { method = "GET", body, headers, args, version = "v1" } = options ?? {};

  const bodyString = body ? JSON.stringify(body) : undefined;
  const token = getToken();
  const url = new URL(`${API_URL}/api/${version}/${path}`);

  if (args) {
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value.toString());
      }
    }
  }

  const response = await fetch(url.toString(), {
    method,
    body: bodyString,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
  });

  try {
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        tokenCache.setState({ token: null });
      }

      return [null, { message: data.message, status: response.status }];
    }
    return [data, null];
  } catch (error) {
    return [
      null,
      { message: (error as Error).message, status: response.status },
    ];
  }
}
