from __future__ import annotations

import logging
import os

from .client import KajggClient
from .gateway import Gateway
from .logging import setup_logging

BASE_URL = "https://chat.kaj.gg"


async def run(
    username: str,
    password: str,
    *,
    base_url: str | None = None,
    gateway_url: str | None = None,
    log_level: str | None = None,
) -> None:
    setup_logging(log_level)

    client = KajggClient(
        base_url=base_url or BASE_URL, gateway_url=gateway_url or BASE_URL
    )

    try:
        user = await client.login(username, password)
        logging.info("logged in as %s", user.username)

        gw = Gateway(client)
        await gw.run_forever()
    finally:
        await client.aclose()
