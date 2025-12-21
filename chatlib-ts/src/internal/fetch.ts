import { fetch as undiciFetch } from "undici";

export function getFetch(): typeof fetch {
  return globalThis.fetch ?? (undiciFetch as unknown as typeof fetch);
}
