import asyncio
import logging
import re
from typing import Optional
from urllib.parse import urljoin

import aiohttp
from modules.utils import dtoa
from chat_types.models import Message as ApiMessage
from modules.db import Embed as DbEmbed, Message as DbMessage
from bs4 import BeautifulSoup
from chat_types.events import MessageUpdated
from modules.events import publish_event


_URL_RE = re.compile(r"https?://[^\s]+", re.IGNORECASE)


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


async def fetch_embed(url: str, *, session: aiohttp.ClientSession) -> Optional[DbEmbed]:
    try:
        async with session.get(url, allow_redirects=True) as response:
            # non-200 should just mean "no embed", not "kill the task"
            if response.status < 200 or response.status >= 300:
                return None

            content_type = (response.headers.get("content-type") or "").lower()
            if (
                "text/html" not in content_type
                and "application/xhtml+xml" not in content_type
            ):
                return None

            max_bytes = 512 * 1024
            raw = await response.content.read(max_bytes + 1)
            if len(raw) > max_bytes:
                return None

            try:
                encoding = response.get_encoding()
            except Exception:
                encoding = "utf-8"
            html = raw.decode(encoding, errors="ignore")

            soup = BeautifulSoup(html, "html.parser")
            final_url = str(response.url)

            title = _first_nonempty(
                _meta_content(soup, key="og:title"),
                (
                    soup.find("title").get_text(strip=True)
                    if soup.find("title")
                    else None
                ),
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
                _meta_content(soup, key="og:url"), canonical, final_url, url
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
            if not any([embed.title, embed.description, embed.image_url, embed.footer]):
                return None
            return embed
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
        timeout=timeout, connector=connector, headers=headers
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
    message.system_embeds = embeds
    await message.save_changes()

    publish_event(MessageUpdated(message=dtoa(ApiMessage, message)))
