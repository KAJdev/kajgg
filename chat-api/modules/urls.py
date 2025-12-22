import asyncio
import logging
import re
from typing import Optional
from urllib.parse import urljoin

import aiohttp
from chat_types.models import Message as ApiMessage
from modules.db import Embed as DbEmbed, Message as DbMessage
from bs4 import BeautifulSoup
from chat_types.events import MessageUpdated
from modules.events import publish_event
from modules.serializers import message_to_api


_URL_RE = re.compile(r"https?://[^\s]+", re.IGNORECASE)
_HTML_CT = {"text/html", "application/xhtml+xml"}

_BLACKLIST_URLS = [
    re.compile(
        rf"https?://(?:www\.)?kaj\.gg/invites/([0-9a-fA-F-]{8,}|[A-Za-z0-9_-]{6,})"
    ),
]


def _clean_candidate_url(raw: str) -> Optional[str]:
    if not raw:
        return None

    # i know this looks cursed but it fixes the classic "https://x.y)" type url grabs
    url = raw.strip().strip("'\"<>")

    # drop trailing punctuation / unmatched closers
    while url and url[-1] in ".,!?":
        url = url[:-1]
    for opener, closer in [("(", ")"), ("[", "]"), ("{", "}")]:
        while url.endswith(closer) and url.count(opener) < url.count(closer):
            url = url[:-1]

    return url or None


def parse_urls(text: Optional[str]) -> list[str]:
    if not text:
        return []
    found = _URL_RE.findall(text)
    cleaned = []
    for raw in found:
        if any(pattern.match(raw) for pattern in _BLACKLIST_URLS):
            continue
        u = _clean_candidate_url(raw)
        if u:
            cleaned.append(u)
    return cleaned


def _first_nonempty(*values: Optional[str]) -> Optional[str]:
    for v in values:
        if v is None:
            continue
        v = str(v).strip()
        if v:
            return v
    return None


def _meta_content(
    soup: BeautifulSoup, *, key: str, attr: str = "property"
) -> Optional[str]:
    tag = soup.find("meta", attrs={attr: key})
    if not tag:
        return None
    return tag.get("content")


def _normalize_color(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = value.strip()
    if re.fullmatch(r"#([0-9a-fA-F]{6})", v):
        return v.lower()
    if re.fullmatch(r"#([0-9a-fA-F]{3})", v):
        # like #fff -> #ffffff
        rgb = v[1:]
        return ("#" + "".join([c * 2 for c in rgb])).lower()
    return None


def _content_type(headers: aiohttp.typedefs.LooseHeaders) -> str:
    # content-type can come with a charset; we only care about the mime part
    ct = (headers.get("content-type") or "").lower()
    return ct.split(";", 1)[0].strip()


def _media_kind_from_content_type(ct: str) -> Optional[str]:
    if not ct:
        return None
    if ct.startswith("image/"):
        return "image"
    if ct.startswith("video/"):
        return "video"
    if ct.startswith("audio/"):
        return "audio"
    return None


def _looks_like_html_prefix(buf: bytes) -> bool:
    if not buf:
        return False
    b = buf.lstrip()
    # html tends to start with doctype, html tag, or a comment
    return (
        b.startswith(b"<!doctype")
        or b.startswith(b"<html")
        or b.startswith(b"<!--")
        or b.startswith(b"<")
    )


def _sniff_media_kind(buf: bytes) -> Optional[str]:
    # tiny magic-byte sniffer so we can detect media even if the server lies about content-type
    if not buf:
        return None

    checks: list[tuple[str, callable]] = [
        # images
        ("image", lambda b: b.startswith(b"\x89PNG\r\n\x1a\n")),  # png
        ("image", lambda b: b.startswith(b"\xff\xd8\xff")),  # jpeg
        ("image", lambda b: b.startswith(b"GIF87a") or b.startswith(b"GIF89a")),  # gif
        (
            "image",
            lambda b: len(b) >= 12 and b[0:4] == b"RIFF" and b[8:12] == b"WEBP",
        ),  # webp
        # videos
        ("video", lambda b: len(b) >= 12 and b[4:8] == b"ftyp"),  # mp4-ish
        ("video", lambda b: b.startswith(b"\x1a\x45\xdf\xa3")),  # webm/mkv (ebml)
        # audio (ogg can be video too but it's fine to treat as audio here)
        ("audio", lambda b: b.startswith(b"OggS")),  # ogg
        (
            "audio",
            lambda b: len(b) >= 12 and b[0:4] == b"RIFF" and b[8:12] == b"WAVE",
        ),  # wav
        ("audio", lambda b: b.startswith(b"fLaC")),  # flac
        (
            "audio",
            lambda b: b.startswith(b"ID3")
            or (len(b) >= 2 and b[0] == 0xFF and (b[1] & 0xE0) == 0xE0),
        ),  # mp3
        (
            "audio",
            lambda b: len(b) >= 2 and b[0] == 0xFF and (b[1] & 0xF6) == 0xF0,
        ),  # aac adts
    ]

    for kind, fn in checks:
        if fn(buf):
            return kind
    return None


def _media_embed_for(kind: str, url: str) -> DbEmbed:
    # user asked for "only *_url set", so don't set title/url/footer/etc
    if kind == "image":
        return DbEmbed(image_url=url)
    if kind == "video":
        return DbEmbed(video_url=url)
    if kind == "audio":
        return DbEmbed(audio_url=url)
    return DbEmbed()


async def _read_limited(
    response: aiohttp.ClientResponse, *, limit: int
) -> Optional[bytes]:
    raw = await response.content.read(limit + 1)
    if len(raw) > limit:
        return None
    return raw


def _parse_html_embed(
    raw: bytes, *, final_url: str, original_url: str
) -> Optional[DbEmbed]:
    try:
        encoding = "utf-8"
        html = raw.decode(encoding, errors="ignore")
    except Exception:
        html = raw.decode("utf-8", errors="ignore")

    soup = BeautifulSoup(html, "html.parser")
    title = _first_nonempty(
        _meta_content(soup, key="og:title"),
        (soup.find("title").get_text(strip=True) if soup.find("title") else None),
    )
    description = _first_nonempty(
        _meta_content(soup, key="og:description"),
        _meta_content(soup, key="description", attr="name"),
    )

    image = _first_nonempty(_meta_content(soup, key="og:image"))
    if image:
        image = urljoin(final_url, image)

    canonical = None
    canonical_tag = soup.find("link", attrs={"rel": "canonical"})
    if canonical_tag:
        canonical = canonical_tag.get("href")

    embed_url = _first_nonempty(
        _meta_content(soup, key="og:url"), canonical, final_url, original_url
    )
    if embed_url:
        embed_url = urljoin(final_url, embed_url)

    footer = _first_nonempty(_meta_content(soup, key="og:site_name"))
    color = _normalize_color(
        _first_nonempty(
            _meta_content(soup, key="theme-color"),
            _meta_content(soup, key="theme-color", attr="name"),
        )
    )

    embed = DbEmbed(
        title=title,
        description=description,
        image_url=image,
        url=embed_url,
        footer=footer,
        color=color,
    )

    # don't send empty shells
    if not any(
        [
            embed.title,
            embed.description,
            embed.image_url,
            embed.video_url,
            embed.audio_url,
            embed.footer,
        ]
    ):
        return None
    return embed


async def _sniff_non_html_embed(
    response: aiohttp.ClientResponse,
    *,
    final_url: str,
    ct: str,
    sniff_bytes: int,
    max_html_bytes: int,
) -> Optional[DbEmbed | bytes]:
    # if it's not html, we still do a tiny sniff in case the server lies about ct
    kind = _media_kind_from_content_type(ct)
    if kind:
        return _media_embed_for(kind, final_url)

    prefix = await response.content.read(sniff_bytes)
    sniffed = _sniff_media_kind(prefix)
    if sniffed:
        return _media_embed_for(sniffed, final_url)

    # some servers send html with bogus ct like application/octet-stream
    if not _looks_like_html_prefix(prefix):
        return None

    rest = await _read_limited(response, limit=max_html_bytes - len(prefix))
    if rest is None:
        return None
    return prefix + rest


async def fetch_embed(url: str, *, session: aiohttp.ClientSession) -> Optional[DbEmbed]:
    try:
        async with session.get(url, allow_redirects=True) as response:
            # non-200 should just mean "no embed", not "kill the task"
            if response.status < 200 or response.status >= 300:
                return None

            final_url = str(response.url)
            ct = _content_type(response.headers)

            # if it's clearly media, don't download it at all
            kind = _media_kind_from_content_type(ct)
            if kind:
                return _media_embed_for(kind, final_url)

            max_html_bytes = 512 * 1024  # 512kb
            sniff_bytes = (
                24 * 1024
            )  # 24kb because some sites have FAT AF HEADERS BRO OMG

            if ct in _HTML_CT:
                raw = await _read_limited(response, limit=max_html_bytes)
                if raw is None:
                    return None
                return _parse_html_embed(raw, final_url=final_url, original_url=url)

            sniff_raw = await _sniff_non_html_embed(
                response,
                final_url=final_url,
                ct=ct,
                sniff_bytes=sniff_bytes,
                max_html_bytes=max_html_bytes,
            )

            # direct media embed
            if isinstance(sniff_raw, DbEmbed):
                return sniff_raw

            # sniff decided it's html, so parse it
            if isinstance(sniff_raw, (bytes, bytearray)):
                return _parse_html_embed(
                    bytes(sniff_raw), final_url=final_url, original_url=url
                )

                return None
    except Exception as e:
        logging.error(f"failed to fetch embed {url}: {e}")
        return None


async def collect_message_embeds(content: Optional[str]) -> list[DbEmbed]:
    urls = parse_urls(content)
    if not urls:
        return []

    # cap + dedupe so a spammy message can't explode the unfurler
    urls = list(dict.fromkeys(urls))[:5]

    timeout = aiohttp.ClientTimeout(total=8, connect=3, sock_read=5)
    connector = aiohttp.TCPConnector(limit=10, ttl_dns_cache=300)
    headers = {"User-Agent": "kaj.gg/1.0"}

    async with aiohttp.ClientSession(
        timeout=timeout,
        connector=connector,
        headers=headers,
        max_line_size=8190 * 4,
        # fixing exception: Got more than 8190 bytes when reading Header value is too long (people abuse tf out of csp)
        max_field_size=8190 * 4,
    ) as session:
        embeds = await asyncio.gather(
            *[fetch_embed(url, session=session) for url in urls if url],
            return_exceptions=True,
        )

    out: list[DbEmbed] = []
    for e in embeds:
        if isinstance(e, Exception):
            continue
        if e:
            out.append(e)
    return out


async def embed_message_content(message: DbMessage):
    embeds = await collect_message_embeds(message.content)
    # short circuit if the embeds are the same
    if message.system_embeds == embeds:
        return
    message.system_embeds = embeds
    await message.save_changes()

    publish_event(MessageUpdated(message=await message_to_api(message)))
