import { getFetch } from "./internal/fetch";
import { EventType } from "./types";
import type { Event } from "./types";

export type GatewayOptions = {
  gatewayUrl: string;
  token: string;
  onEvent: (evt: { t: string; d?: unknown; ts?: string | number }) => void;
  onConnected?: () => void;
};

export class Gateway {
  private gatewayUrl: string;
  private token: string;
  private onEvent: GatewayOptions["onEvent"];
  private onConnected?: GatewayOptions["onConnected"];
  private abort: AbortController | null = null;
  private closed = false;
  private lastEventTs: string | null = null;

  constructor(opts: GatewayOptions) {
    this.gatewayUrl = opts.gatewayUrl.replace(/\/$/, "");
    this.token = opts.token;
    this.onEvent = opts.onEvent;
    this.onConnected = opts.onConnected;
  }

  close() {
    this.closed = true;
    this.abort?.abort();
  }

  private buildUrl(): string {
    const url = new URL(`${this.gatewayUrl}/gateway`);
    url.searchParams.set("token", this.token);
    if (this.lastEventTs)
      url.searchParams.set("last_event_ts", this.lastEventTs);
    return url.toString();
  }

  async runForever(): Promise<void> {
    let retryMs = 500;
    while (!this.closed) {
      this.abort = new AbortController();
      const url = this.buildUrl();
      try {
        const fetchImpl = getFetch();
        const resp = await fetchImpl(url, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            "User-Agent": "kajgg-client/0.1.0",
          },
          signal: this.abort.signal,
        });

        if (!resp.ok) throw new Error(`bad status ${resp.status}`);
        const ct = resp.headers.get("content-type") ?? "";
        if (!ct.includes("text/event-stream"))
          throw new Error(`bad content-type ${ct}`);
        if (!resp.body) throw new Error("no response body");

        retryMs = 500;
        this.onConnected?.();
        await this.consume(resp.body);
        throw new Error("stream closed");
      } catch (err) {
        if (this.closed) return;
        if ((err as any)?.name === "AbortError") return;
        await new Promise((r) => setTimeout(r, retryMs));
        retryMs = Math.min(Math.floor(retryMs * 1.5), 10_000);
      }
    }
  }

  private async consume(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let dataLines: string[] = [];

    while (!this.closed) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const rawLine = buf.slice(0, idx);
        buf = buf.slice(idx + 1);

        const line = rawLine.replace(/\r$/, "");
        if (line === "") {
          if (dataLines.length) {
            const dataStr = dataLines.join("\n");
            dataLines = [];
            this.handleFrame(dataStr);
          }
          continue;
        }

        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
    }
  }

  private handleFrame(dataStr: string) {
    let payload: any;
    try {
      payload = JSON.parse(dataStr);
    } catch {
      return;
    }

    if (!payload || typeof payload.t !== "string") return;
    if (payload.t === EventType.HEARTBEAT) return;

    // track last ts for resume
    const ts = payload.ts;
    if (typeof ts === "string" || typeof ts === "number") {
      this.lastEventTs = String(ts);
    }

    this.onEvent(payload as Event & { ts?: string | number });
  }
}
