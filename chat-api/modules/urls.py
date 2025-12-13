import asyncio
import logging
import re, aiohttp
from modules.utils import dtoa
from chat_types.models import Embed, Message
from bs4 import BeautifulSoup
from chat_types.events import MessageUpdated
from modules.events import publish_event


def parse_urls(text: str) -> list[str]:
    return re.findall(r"https?://[^\s]+", text)


async def fetch_embed(url: str) -> Embed:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url, headers={"user-Agent": "kaj.gg/1.0"}
            ) as response:
                if response.status != 200:
                    raise Exception(f"Failed to fetch embed: {response.status}")

                html = await response.text()

                soup = BeautifulSoup(html, "html.parser")
                return Embed(
                    title=soup.find("title").text,
                    description=soup.find("meta[property='og:description']").get(
                        "content"
                    ),
                    image_url=soup.find("meta[property='og:image']").get("content"),
                    url=soup.find("meta[property='og:url']").get("content") or url,
                    footer=soup.find("meta[property='og:site_name']").get("content"),
                    color=soup.find("meta[property='theme-color']").get("content"),
                )
    except Exception as e:
        logging.error(f"Failed to fetch embed {url}: {e}")
        return None


async def collect_message_embeds(content: str) -> list[Embed]:
    urls = parse_urls(content)
    embeds = await asyncio.gather(*[fetch_embed(url) for url in urls if url])
    return [e for e in embeds if e]


async def embed_message_content(message: Message):
    embeds = await collect_message_embeds(message.content)
    message.embeds = embeds
    await message.save_changes()

    publish_event(MessageUpdated(message=dtoa(Message, message.dict())))
