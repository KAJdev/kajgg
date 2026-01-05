from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from yarl import URL

from .client import KajggClient
from .context import Context
from .dispatcher import dispatch
from .events import EventType, parse_event_data


class Gateway:
    def __init__(self, client: KajggClient):
        self.client = client
        self._closed = False
        self._last_event_ts: int | None = None

    def close(self) -> None:
        self._closed = True

    def _build_url(self) -> str:
        url = URL(f"{self.client.gateway_url}/gateway")
        params: dict[str, str] = {}
        if self._last_event_ts is not None:
            params["last_event_ts"] = str(self._last_event_ts)
        if self.client.token:
            params["token"] = self.client.token
        return str(url.with_query(params))

    async def run_forever(self) -> None:
        retry_ms = 500

        while not self._closed:
            url = self._build_url()

            try:
                async with self.client._session.get(
                    url,
                    headers={"Accept": "text/event-stream"},
                ) as resp:
                    if resp.status != 200:
                        raise RuntimeError(f"bad status {resp.status}")

                    ct = resp.headers.get("content-type", "")
                    if "text/event-stream" not in ct:
                        raise RuntimeError(f"bad content-type {ct}")

                    retry_ms = 500
                    logging.info("gateway connected")

                    await self._consume_stream(resp)

            except asyncio.CancelledError:
                raise
            except Exception as e:
                if self._closed:
                    break
                logging.warning("gateway retrying: %s", e)
                await asyncio.sleep(retry_ms / 1000)
                retry_ms = min(int(retry_ms * 1.5), 10_000)

    async def _consume_stream(self, resp: Any) -> None:
        data_lines: list[str] = []

        while not self._closed:
            raw = await resp.content.readline()
            if not raw:
                break

            line = raw.decode("utf-8", errors="replace").rstrip("\n").rstrip("\r")

            if line == "":
                if data_lines:
                    data_str = "\n".join(data_lines)
                    data_lines = []
                    await self._handle_frame(data_str)
                continue

            if line.startswith("data:"):
                data_lines.append(line[5:].lstrip())

        raise RuntimeError("stream closed")

    async def _handle_frame(self, data_str: str) -> None:
        try:
            payload = json.loads(data_str)
        except Exception as e:
            logging.warning("malformed sse frame: %s", e)
            return

        t_raw = payload.get("t")
        if not isinstance(t_raw, str):
            return

        if t_raw == EventType.HEARTBEAT.value:
            return

        try:
            event_type = EventType(t_raw)
        except Exception:
            logging.warning("unknown event type: %s", t_raw)
            return

        ts_raw = payload.get("ts")
        ts_int: int | None = None
        if isinstance(ts_raw, (int, float)):
            ts_int = int(ts_raw)
        elif isinstance(ts_raw, str):
            try:
                ts_int = int(ts_raw)
            except Exception:
                ts_int = None

        if ts_int is not None:
            self._last_event_ts = ts_int

        d = payload.get("d") if isinstance(payload.get("d"), dict) else {}
        ctx = Context(client=self.client, raw=payload, ts=ts_int)
        event_obj = parse_event_data(event_type, d)

        # attach ctx so ctx.send works on typed events
        if hasattr(event_obj, "_attach"):
            try:
                event_obj._attach(ctx)  # type: ignore[attr-defined]
            except Exception:
                pass

        await dispatch(event_type, event_obj)
