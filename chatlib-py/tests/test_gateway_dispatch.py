import asyncio
import json
from datetime import datetime, timezone

import pytest
from aiohttp import web

from kajgg import EventType, listen
from kajgg.client import KajggClient
from kajgg.dispatcher import _handlers
from kajgg.events import MessageCreated
from kajgg.gateway import Gateway


@pytest.mark.asyncio
async def test_gateway_dispatch_and_ctx_send(run_server):
    _handlers.clear()

    token = "tok_test"
    channel_id = "chan_1"

    got = asyncio.Event()

    @listen(EventType.MESSAGE_CREATED)
    async def on_message_created(ctx: MessageCreated):
        await ctx.send("yo")
        got.set()

    async def login(request: web.Request):
        payload = await request.json()
        assert payload["username"] == "u"
        assert payload["password"] == "p"

        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        return web.json_response(
            {
                "id": "me",
                "username": "u",
                "email": "u@x.y",
                "created_at": now,
                "updated_at": now,
                "token": token,
            }
        )

    async def post_message(request: web.Request):
        assert request.headers.get("Authorization") == token
        payload = await request.json()
        assert payload["content"] == "yo"

        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        return web.json_response(
            {
                "id": "m1",
                "type": "default",
                "content": payload["content"],
                "files": [],
                "created_at": now,
                "updated_at": None,
                "author_id": "me",
                "channel_id": channel_id,
            }
        )

    async def gateway(request: web.Request):
        assert request.query.get("token") == token

        resp = web.StreamResponse(
            status=200,
            headers={
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )
        await resp.prepare(request)

        frame = {
            "t": "MESSAGE_CREATED",
            "d": {
                "message": {
                    "id": "m0",
                    "type": "default",
                    "content": "hi",
                    "files": [],
                    "created_at": datetime.now(timezone.utc)
                    .isoformat()
                    .replace("+00:00", "Z"),
                    "updated_at": None,
                    "author_id": "me",
                    "channel_id": channel_id,
                },
                "author": {
                    "id": "me",
                    "username": "u",
                    "created_at": datetime.now(timezone.utc)
                    .isoformat()
                    .replace("+00:00", "Z"),
                    "updated_at": datetime.now(timezone.utc)
                    .isoformat()
                    .replace("+00:00", "Z"),
                },
            },
            "ts": "123",
        }

        await resp.write(f"data: {json.dumps(frame)}\n\n".encode("utf-8"))
        await resp.write_eof()
        return resp

    app = web.Application()
    app.router.add_post("/api/v1/login", login)
    app.router.add_post("/api/v1/channels/{channel_id}/messages", post_message)
    app.router.add_get("/gateway", gateway)

    base = await run_server(app)
    client = KajggClient(base_url=base, gateway_url=base)
    try:
        await client.login("u", "p")

        gw = Gateway(client)
        task = asyncio.create_task(gw.run_forever())
        await asyncio.wait_for(got.wait(), timeout=2.0)

        gw.close()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    finally:
        await client.aclose()
