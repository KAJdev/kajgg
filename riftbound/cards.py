from __future__ import annotations

import asyncio, aiohttp
import re
from dataclasses import dataclass
from enum import Enum
from typing import Final

SETS = {
    "OGN": "https://cdn.rgpub.io/public/live/map/riftbound/latest/OGN/metadata.json",
    "OGS": "https://cdn.rgpub.io/public/live/map/riftbound/latest/OGS/metadata.json",
}

PILTOVER_CARDS_URL: Final[str] = "https://piltoverarchive.com/cards"
# 48 cards per page right now, but we still stop based on "no new cards" to be safe
PILTOVER_MAX_PAGES: Final[int] = 30

# (set_code, number) -> (energy, power, might, color)
_piltover_stats_cache: dict[tuple[str, int], tuple[int, int, int, Color]] | None = None
_piltover_stats_lock = asyncio.Lock()


def _parse_piltover_cards_html(
    html: str,
) -> dict[tuple[str, int], tuple[int, int, int, Color]]:
    # next server components stream dumps the card data into the html, so we just vibe and regex it
    stats: dict[tuple[str, int], tuple[int, int, int, Color]] = {}

    idx = 0
    while True:
        pos = html.find("Card Number", idx)
        if pos == -1:
            break

        # the actual code looks like OGN-033, OGS-012, etc
        m = re.search(r"([A-Z]{3})-(\d{3})", html[pos : pos + 2500])
        if not m:
            idx = pos + 10
            continue

        set_code = m.group(1)
        number = int(m.group(2))

        next_pos = html.find("Card Number", pos + 10)
        block = html[pos : next_pos if next_pos != -1 else len(html)]
        block_clean = block.replace('\\"', '"')

        def _find_stat(label: str) -> int | None:
            m2 = re.search(
                rf"\"children\":\"{label}\"[\s\S]{{0,5000}}?\"children\":(\d+)",
                block_clean,
            )
            return int(m2.group(1)) if m2 else None

        energy = _find_stat("Energy")
        power = _find_stat("Power")
        might = _find_stat("Might")

        # color lives near the mana bars, e.g. https://cdn.piltoverarchive.com/colors/Fury.webp
        color: Color | None = None
        m_color = re.search(
            r"https://cdn\.piltoverarchive\.com/colors/([A-Za-z]+)\.webp",
            block_clean,
        )
        if m_color:
            faction = m_color.group(1).lower()
            try:
                color = Color(faction)
            except ValueError:
                color = None

        if (
            energy is not None
            and power is not None
            and might is not None
            and color is not None
        ):
            stats[(set_code, number)] = (energy, power, might, color)

        idx = pos + 10

    return stats


async def _get_piltover_stats(
    session: aiohttp.ClientSession,
) -> dict[tuple[str, int], tuple[int, int, int, Color]]:
    global _piltover_stats_cache

    if _piltover_stats_cache is not None:
        return _piltover_stats_cache

    async with _piltover_stats_lock:
        if _piltover_stats_cache is not None:
            return _piltover_stats_cache

        all_stats: dict[tuple[str, int], tuple[int, int, int, Color]] = {}
        seen: set[tuple[str, int]] = set()

        for page in range(1, PILTOVER_MAX_PAGES + 1):
            url = f"{PILTOVER_CARDS_URL}?page={page}"
            async with session.get(url) as response:
                html = await response.text()

            page_stats = _parse_piltover_cards_html(html)
            if not page_stats:
                break

            new_keys = set(page_stats.keys()) - seen
            if not new_keys:
                break

            for k in new_keys:
                all_stats[k] = page_stats[k]
            seen |= set(page_stats.keys())

        _piltover_stats_cache = all_stats
        return all_stats


class Rarity(Enum):
    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"
    EPIC = "epic"


class Orientation(Enum):
    LANDSCAPE = "landscape"
    PORTRAIT = "portrait"


class Color(Enum):
    FURY = "fury"
    CALM = "calm"
    MIND = "mind"
    BODY = "body"
    CHAOS = "chaos"
    ORDER = "order"


class Type(Enum):
    UNIT = "unit"
    SPELL = "spell"
    GEAR = "gear"


class Super(Enum):
    CHAMPION = "champion"
    LEGEND = "legend"


class Keyword(Enum):
    HIDDEN = "hidden"
    ACTION = "action"
    REACTION = "reaction"
    TANK = "tank"
    ASSAULT = "assault"
    DEATHKNELL = "deathknell"


def get_from_alt_text(field: str, text: str) -> str | None:
    for line in text.split("\n"):
        if field in line:
            value = line.split(f"{field}: ")[1].split(".")[0].strip()
            if value == "None":
                return None
            return value
    return None


@dataclass
class Card:
    id: str
    number: int
    title: str
    type: Type | None
    super: Super | None
    orientation: Orientation
    rarity: Rarity
    tags: list[str]
    set: str
    color: Color | None = None
    energy: int | None = None
    power: int | None = None
    might: int | None = None
    has_alt: bool = False
    has_signed: bool = False
    text: str | None = None

    @classmethod
    def parse_alt_text(cls, text: str) -> dict:
        rarity = get_from_alt_text("Rarity", text)
        card_type = get_from_alt_text("Type", text)
        super = get_from_alt_text("Super", text)
        tags = get_from_alt_text("Tags", text)
        card_text = text.split(f"How to play this card: ")[1].strip()
        if tags:
            tags = [tag.strip() for tag in tags.split(",")]

        return {
            "rarity": rarity,
            "type": card_type,
            "super": super,
            "tags": tags,
            "text": card_text,
        }

    @classmethod
    def from_dict(cls, data: dict, set: str) -> "Card":
        info = cls.parse_alt_text(data["altText"])

        if not info:
            raise ValueError(f"Failed to parse alt text for card {data['id']}")

        return Card(
            id=data["id"],
            set=set,
            number=data["number"],
            title=data["title"].replace("(alt)", "").strip(),
            type=info["type"],
            super=info["super"],
            orientation=data["orientation"],
            rarity=info["rarity"],
            tags=info["tags"],
            text=info["text"],
        )

    @classmethod
    def is_alt(cls, data: dict) -> bool:
        return data["id"].endswith("a")

    @classmethod
    def is_signed(cls, data: dict) -> bool:
        return data["id"].endswith("s")

    @property
    def image_url(self) -> str:
        return f"https://cdn.piltoverarchive.com/cards/{self.set}-{self.number:03d}.webp?width=3840"

    @property
    def alt_image_url(self) -> str:
        return f"https://cdn.piltoverarchive.com/cards/{self.set}-{self.number:03d}a.webp?width=3840"

    @property
    def signed_image_url(self) -> str:
        return f"https://cdn.piltoverarchive.com/cards/{self.set}-{self.number:03d}s.webp?width=3840"

    def __str__(self):
        return f"{self.title} ({self.id}) - {self.color} - {self.type} - {self.super} - {self.rarity} - {self.tags}"


async def get_cards(set_name: str) -> list[Card]:
    async with aiohttp.ClientSession() as session:
        async with session.get(SETS[set_name]) as response:
            data = await response.json()
            cards: dict[int, Card] = {}
            for card_data in data["items"]:
                card = Card.from_dict(card_data, set_name)
                if card.number not in cards:
                    cards[card.number] = card
                if Card.is_alt(card_data):
                    cards[card.number].has_alt = True
                if Card.is_signed(card_data):
                    cards[card.number].has_signed = True

            piltover_stats = await _get_piltover_stats(session)
            for card in cards.values():
                stats = piltover_stats.get((card.set, card.number))
                if stats:
                    card.energy, card.power, card.might, card.color = stats

            return list(cards.values())


async def main():
    cards = await get_cards("OGN")
    for card in cards:
        print(card)

    cards = await get_cards("OGS")
    for card in cards:
        print(card)


if __name__ == "__main__":
    asyncio.run(main())
