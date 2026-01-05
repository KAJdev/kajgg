"""
card data fetching and management.
pulls card data from riot's manifests and caches it.
"""
import aiohttp
import json
from pathlib import Path
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

# card set manifest urls
SETS = {
    "OGN": "https://cdn.rgpub.io/public/live/map/riftbound/latest/OGN/metadata.json",
    "OGS": "https://cdn.rgpub.io/public/live/map/riftbound/latest/OGS/metadata.json",
}


class Rarity(str, Enum):
    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"
    EPIC = "epic"


class Orientation(str, Enum):
    LANDSCAPE = "landscape"
    PORTRAIT = "portrait"


class CardType(str, Enum):
    UNIT = "unit"
    SPELL = "spell"
    GEAR = "gear"


class SuperType(str, Enum):
    CHAMPION = "champion"
    LEGEND = "legend"


class Keyword(str, Enum):
    HIDDEN = "hidden"
    ACTION = "action"
    REACTION = "reaction"
    TANK = "tank"
    ASSAULT = "assault"
    DEATHKNELL = "deathknell"


def get_from_alt_text(field_name: str, text: str) -> Optional[str]:
    """extract a field value from card alt text"""
    for line in text.split("\n"):
        if field_name in line:
            value = line.split(f"{field_name}: ")[1].split(".")[0].strip()
            if value == "None":
                return None
            return value
    return None


@dataclass
class Card:
    id: str
    number: int
    title: str
    card_type: Optional[str]
    super_type: Optional[str]
    orientation: str
    rarity: str
    tags: list[str]
    set_code: str
    has_alt: bool = False
    has_signed: bool = False
    
    # game stats (defaults, would be overridden by real card data)
    attack: int = 0
    health: int = 0
    cost: int = 0
    rune_value: int = 0
    keywords: list[str] = field(default_factory=list)
    energy: int | None = None
    power: int | None = None
    might: int | None = None
    color: str | None = None
    text: str | None = None

    @classmethod
    def parse_alt_text(cls, text: str) -> dict:
        rarity = get_from_alt_text("Rarity", text)
        card_type = get_from_alt_text("Type", text)
        super_type = get_from_alt_text("Super", text)
        tags_str = get_from_alt_text("Tags", text)
        tags = [tag.strip() for tag in tags_str.split(",")] if tags_str else []
        return {
            "rarity": rarity.lower() if rarity else None,
            "card_type": card_type.lower() if card_type else None,
            "super_type": super_type.lower() if super_type else None,
            "tags": tags,
        }

    @classmethod
    def from_dict(cls, data: dict, set_code: str) -> "Card":
        info = cls.parse_alt_text(data.get("altText", ""))
        return Card(
            id=data["id"],
            set_code=set_code,
            number=data["number"],
            title=data["title"].replace("(alt)", "").strip(),
            card_type=info.get("card_type"),
            super_type=info.get("super_type"),
            orientation=(data.get("orientation", "portrait") or "portrait").lower(),
            rarity=info.get("rarity", "common") or "common",
            tags=info.get("tags", []),
        )

    @classmethod
    def is_alt(cls, data: dict) -> bool:
        return data["id"].endswith("a")

    @classmethod
    def is_signed(cls, data: dict) -> bool:
        return data["id"].endswith("s")

    @property
    def image_url(self) -> str:
        return f"https://cdn.piltoverarchive.com/cards/{self.set_code}-{self.number:03d}.webp?width=480"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "number": self.number,
            "title": self.title,
            "type": self.card_type,
            "superType": self.super_type,
            "orientation": self.orientation,
            "rarity": self.rarity,
            "tags": self.tags,
            "set": self.set_code,
            "hasAlt": self.has_alt,
            "hasSigned": self.has_signed,
            "attack": self.attack,
            "health": self.health,
            "cost": self.cost,
            "runeValue": self.rune_value,
            "keywords": self.keywords,
            "energy": self.energy,
            "power": self.power,
            "might": self.might,
            "color": self.color,
            "text": self.text,
        }


# global card cache
_cards: dict[str, Card] = {}
_stats: dict[str, dict] = {}


def _load_static_stats():
    global _stats
    stats_path = Path(__file__).resolve().parents[1] / "data" / "card_stats.json"
    if not stats_path.exists():
        _stats = {}
        return

    try:
        _stats = json.loads(stats_path.read_text())
    except Exception:
        _stats = {}


def _derive_keywords(text: str | None) -> list[str]:
    if not text or not isinstance(text, str):
        return []
    # minimal keyword extraction (not full rules engine)
    kws = set()
    for kw in [
        "accelerate",
        "action",
        "reaction",
        "assault",
        "deathknell",
        "deflect",
        "ganking",
        "hidden",
        "legion",
        "shield",
        "tank",
        "temporary",
        "vision",
        "equip",
        "quick-draw",
        "repeat",
        "weaponmaster",
    ]:
        if re.search(rf"\b{re.escape(kw)}\b", text, flags=re.IGNORECASE):
            kws.add(kw)
    if "T:" in text or text.strip().startswith("T:"):
        kws.add("tap")
    return sorted(kws)


async def fetch_set(set_code: str) -> list[Card]:
    """fetch cards from a specific set"""
    async with aiohttp.ClientSession() as session:
        async with session.get(SETS[set_code]) as response:
            data = await response.json()
            cards_dict: dict[int, Card] = {}
            
            for card_data in data.get("items", []):
                card = Card.from_dict(card_data, set_code)
                
                if card.number not in cards_dict:
                    cards_dict[card.number] = card
                    
                if Card.is_alt(card_data):
                    cards_dict[card.number].has_alt = True
                if Card.is_signed(card_data):
                    cards_dict[card.number].has_signed = True
                    
            return list(cards_dict.values())


async def load_cards():
    """load all card data from all sets"""
    global _cards
    _load_static_stats()
    _cards = {}
    
    for set_code in SETS:
        cards = await fetch_set(set_code)
        for card in cards:
            stat = _stats.get(card.id)
            if isinstance(stat, dict):
                card.energy = stat.get("energy")
                card.power = stat.get("power")
                card.might = stat.get("might")
                card.color = stat.get("color")
                card.text = stat.get("text")
                # derive keywords from rules text (first pass)
                card.keywords = _derive_keywords(card.text)
            _cards[card.id] = card


def get_card(card_id: str) -> Optional[Card]:
    """get a card by id"""
    return _cards.get(card_id)


def get_all_cards() -> list[Card]:
    """get all cards"""
    return list(_cards.values())


def search_cards(query: str) -> list[Card]:
    """search cards by title or tags"""
    query = query.lower()
    results = []
    
    for card in _cards.values():
        if query in card.title.lower():
            results.append(card)
        elif any(query in tag.lower() for tag in card.tags):
            results.append(card)
            
    return results

