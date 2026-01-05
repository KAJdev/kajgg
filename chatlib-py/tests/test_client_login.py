from datetime import datetime, timezone

import pytest
from aiohttp import web

from kajgg.client import KajggClient


@pytest.mark.asyncio
async def test_login_sets_token_and_parses_datetimes(run_server):
    token = "tok_123"

    async def login(request: web.Request):
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

    app = web.Application()
    app.router.add_post("/api/v1/login", login)

    base = await run_server(app)
    client = KajggClient(base_url=base, gateway_url=base)
    try:
        user = await client.login("u", "p")
        assert client.token == token
        assert user.token == token
        assert user.created_at is not None
        assert hasattr(user.created_at, "year")
    finally:
        await client.aclose()
