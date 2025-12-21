from __future__ import annotations

from collections.abc import AsyncIterator, Callable

import pytest
from aiohttp import web


@pytest.fixture
async def run_server() -> AsyncIterator[Callable[[web.Application], str]]:
    runners: list[web.AppRunner] = []

    async def _run(app: web.Application) -> str:
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "127.0.0.1", 0)
        await site.start()

        # grab the chosen port after binding
        sockets = getattr(site, "_server", None).sockets  # type: ignore[attr-defined]
        port = int(sockets[0].getsockname()[1])
        runners.append(runner)
        return f"http://127.0.0.1:{port}"

    try:
        yield _run
    finally:
        for r in runners:
            await r.cleanup()
