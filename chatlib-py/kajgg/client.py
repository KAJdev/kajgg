from __future__ import annotations

from typing import Any

import aiohttp

from ._internal.convert import dataclass_from_dict
from .models import Message, User


class ApiError(RuntimeError):
    def __init__(self, status: int, message: str):
        super().__init__(f"{status}: {message}")
        self.status = status
        self.message = message


class KajggClient:
    def __init__(
        self,
        *,
        base_url: str,
        gateway_url: str | None = None,
        token: str | None = None,
        timeout_s: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.gateway_url = (gateway_url or base_url).rstrip("/")
        self.token = token
        timeout = aiohttp.ClientTimeout(total=timeout_s)
        self._session = aiohttp.ClientSession(
            timeout=timeout, headers={"User-Agent": "kajgg-client/0.1.0"}
        )

    async def aclose(self) -> None:
        await self._session.close()

    def _api_url(self, path: str, *, version: str = "v1") -> str:
        path = path.lstrip("/")
        return f"{self.base_url}/api/{version}/{path}"

    async def request_json(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        auth: bool = True,
    ) -> Any:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if auth and self.token:
            headers["Authorization"] = self.token

        async with self._session.request(
            method,
            self._api_url(path),
            json=json,
            params=params,
            headers=headers,
        ) as resp:
            try:
                data = await resp.json(content_type=None)
            except Exception:
                data = None

            if resp.status < 200 or resp.status >= 300:
                msg = (data or {}).get("message") if isinstance(data, dict) else None
                if not msg:
                    try:
                        msg = await resp.text()
                    except Exception:
                        msg = "request failed"
                raise ApiError(resp.status, str(msg))

            return data

    async def login(self, username: str, password: str) -> User:
        data = await self.request_json(
            "POST",
            "login",
            json={"username": username, "password": password},
            auth=False,
        )
        user = dataclass_from_dict(User, data)
        self.token = user.token
        return user

    async def send_message(
        self,
        channel_id: str,
        content: str,
        *,
        nonce: str | None = None,
        file_ids: list[str] | None = None,
        embeds: list[dict[str, Any]] | None = None,
    ) -> Message:
        body: dict[str, Any] = {}
        trimmed = content.strip()
        if trimmed:
            body["content"] = trimmed
        if nonce is not None:
            body["nonce"] = nonce
        if file_ids:
            body["file_ids"] = file_ids
        if embeds:
            body["embeds"] = embeds

        data = await self.request_json(
            "POST", f"channels/{channel_id}/messages", json=body, auth=True
        )
        return dataclass_from_dict(Message, data)
