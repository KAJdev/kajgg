import asyncio
import ipaddress
import logging
import socket
from os import getenv
from typing import Iterable, Optional
from urllib.parse import unquote, urlsplit, urlunsplit

from aiohttp import ClientSession, ClientTimeout
from dotenv import load_dotenv
from sanic import Sanic
from sanic.exceptions import BadRequest, Forbidden, ServiceUnavailable
from sanic.response import json

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(name)s - %(levelname)s - %(message)s")


def _parse_int_env(name: str, default: int) -> int:
    try:
        return int(getenv(name, str(default)))
    except Exception:
        return default


def _parse_csv_int_env(name: str, default: Iterable[int]) -> set[int]:
    raw = getenv(name)
    if not raw:
        return set(default)
    out: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            out.add(int(part))
        except Exception:
            continue
    return out or set(default)


ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = _parse_csv_int_env("ALLOWED_PORTS", default=(80, 443))
CONNECT_TIMEOUT_S = _parse_int_env("CONNECT_TIMEOUT_S", 10)
TOTAL_TIMEOUT_S = _parse_int_env("TOTAL_TIMEOUT_S", 60)
MAX_BYTES = _parse_int_env("MAX_BYTES", 0)  # 0 = unlimited


def _is_ip_public(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


async def _resolve_host_public(host: str, port: int) -> None:
    loop = asyncio.get_running_loop()
    infos = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    ips = {info[4][0] for info in infos}
    if not ips:
        raise BadRequest("could not resolve host")
    for ip in ips:
        if not _is_ip_public(ip):
            raise Forbidden("blocked host")


def _normalize_target(raw_target: str) -> str:
    # target usually decoded already, but we vibe with % enc too
    target = unquote(raw_target).strip()
    if not target:
        raise BadRequest("missing url")

    split = urlsplit(target)
    if not split.scheme:
        # no scheme? we assume https bc we trust
        target = "https://" + target.lstrip("/")
        split = urlsplit(target)

    if split.scheme.lower() not in ALLOWED_SCHEMES:
        raise BadRequest("unsupported scheme")

    # lil normalization so stuff is consistent
    scheme = split.scheme.lower()
    netloc = split.netloc
    if not netloc:
        raise BadRequest("missing host")

    return urlunsplit((scheme, netloc, split.path, split.query, split.fragment))


def _filtered_response_headers(
    upstream_headers: "aiohttp.typedefs.LooseHeaders",
) -> dict[str, str]:
    passthrough = {
        "content-type",
        "content-length",
        "etag",
        "last-modified",
        "cache-control",
        "expires",
        "content-range",
        "accept-ranges",
        "content-disposition",
    }
    out: dict[str, str] = {}
    for k, v in upstream_headers.items():
        lk = str(k).lower()
        if lk in passthrough:
            out[str(k)] = str(v)
    out["access-control-allow-origin"] = "*"
    out["x-content-type-options"] = "nosniff"
    return out


app = Sanic("media-proxy")
app.config.CORS_ORIGINS = "*"
app.config.FALLBACK_ERROR_FORMAT = "json"


@app.before_server_start
async def _init_http(app, _loop):
    timeout = ClientTimeout(total=TOTAL_TIMEOUT_S, connect=CONNECT_TIMEOUT_S)
    app.ctx.http = ClientSession(timeout=timeout)


@app.after_server_stop
async def _close_http(app, _loop):
    sess: Optional[ClientSession] = getattr(app.ctx, "http", None)
    if sess:
        await sess.close()


@app.get("/health")
async def health(_request):
    return json({"ok": True})


async def _proxy_request(request, method: str, raw_target: str):
    target = _normalize_target(raw_target)
    split = urlsplit(target)
    host = split.hostname
    if not host:
        raise BadRequest("missing host")

    port = split.port or (443 if split.scheme == "https" else 80)
    if port not in ALLOWED_PORTS:
        raise Forbidden("blocked port")

    await _resolve_host_public(host, port)

    upstream_headers: dict[str, str] = {
        "user-agent": "kaj-media-proxy/1",
        "accept": request.headers.get("accept", "*/*"),
        "accept-encoding": "identity",
    }

    # forward range + cache stuff so media players don't cry
    for h in ("range", "if-none-match", "if-modified-since"):
        if h in request.headers:
            upstream_headers[h] = request.headers[h]

    sess: ClientSession = request.app.ctx.http
    try:
        async with sess.request(
            method, target, headers=upstream_headers, allow_redirects=True
        ) as upstream:
            headers = _filtered_response_headers(upstream.headers)

            if MAX_BYTES > 0:
                cl = upstream.headers.get("content-length")
                if cl and cl.isdigit() and int(cl) > MAX_BYTES:
                    raise BadRequest("payload too large")

            if method == "HEAD":
                return await request.respond(status=upstream.status, headers=headers)

            resp = await request.respond(status=upstream.status, headers=headers)
            sent = 0
            async for chunk in upstream.content.iter_chunked(64 * 1024):
                if not chunk:
                    continue
                sent += len(chunk)
                if MAX_BYTES > 0 and sent > MAX_BYTES:
                    raise BadRequest("payload too large")
                await resp.send(chunk)
            await resp.eof()
            return resp
    except BadRequest:
        raise
    except Forbidden:
        raise
    except Exception as e:
        logging.exception("proxy failed", extra={"err": str(e)})
        raise ServiceUnavailable("upstream error")


@app.get("/<path:target>")
async def proxy_get(request, target: str):
    return await _proxy_request(request, "GET", target)


@app.head("/<path:target>")
async def proxy_head(request, target: str):
    return await _proxy_request(request, "HEAD", target)


if __name__ == "__main__":
    port = int(getenv("PORT", "3004"))
    app.run(
        host="0.0.0.0",
        port=port,
        debug=getenv("DEBUG", None) not in (None, "False", "0"),
    )
