from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

import aiohttp


SETS = {
    "OGN": "https://cdn.rgpub.io/public/live/map/riftbound/latest/OGN/metadata.json",
    "OGS": "https://cdn.rgpub.io/public/live/map/riftbound/latest/OGS/metadata.json",
}

PILTOVER_CARDS_URL = "https://piltoverarchive.com/cards"
PILTOVER_MAX_PAGES = 30


def _parse_piltover_cards_html(html: str) -> dict[tuple[str, int], dict]:
    # next server components dumps the card data into the html, so we just vibe and regex it
    import re

    stats: dict[tuple[str, int], dict] = {}

    idx = 0
    while True:
        pos = html.find("Card Number", idx)
        if pos == -1:
            break

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

        color = None
        m_color = re.search(r"https://cdn\.piltoverarchive\.com/colors/([A-Za-z]+)\.webp", block_clean)
        if m_color:
            color = m_color.group(1).lower()

        if energy is not None and power is not None and might is not None and color:
            stats[(set_code, number)] = {
                "energy": energy,
                "power": power,
                "might": might,
                "color": color,
            }

        idx = pos + 10

    return stats


async def _get_piltover_stats(session: aiohttp.ClientSession) -> dict[tuple[str, int], dict]:
    all_stats: dict[tuple[str, int], dict] = {}
    seen: set[tuple[str, int]] = set()

    for page in range(1, PILTOVER_MAX_PAGES + 1):
        url = f"{PILTOVER_CARDS_URL}?page={page}"
        async with session.get(url) as response:
            if response.status != 200:
                print(f"[piltover] page {page} status {response.status}, stopping")
                break
            html = await response.text()

        page_stats = _parse_piltover_cards_html(html)
        if not page_stats:
            print(f"[piltover] page {page}: no stats found, stopping")
            break

        new_keys = set(page_stats.keys()) - seen
        if not new_keys:
            print(f"[piltover] page {page}: no new cards, stopping")
            break

        for k in new_keys:
            all_stats[k] = page_stats[k]
        seen |= set(page_stats.keys())
        print(f"[piltover] page {page}: +{len(new_keys)} (total {len(all_stats)})")

    return all_stats


def _get_from_alt_text(field: str, text: str) -> str | None:
    for line in (text or "").split("\n"):
        if field in line:
            value = line.split(f"{field}: ")[1].split(".")[0].strip()
            if value == "None":
                return None
            return value
    return None


async def main(out_path: Path):
    out_path.parent.mkdir(parents=True, exist_ok=True)

    timeout = aiohttp.ClientTimeout(total=45)
    headers = {
        # piltoverarchive can block default aiohttp UA; pretend to be a browser
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
        piltover_stats = await _get_piltover_stats(session)

        dataset: dict[str, dict] = {}
        for set_code, url in SETS.items():
            async with session.get(url) as response:
                data = await response.json()

            for item in data.get("items", []):
                card_id = item.get("id")
                number = item.get("number")
                title = (item.get("title") or "").replace("(alt)", "").strip()
                orientation = (item.get("orientation") or "portrait").lower()
                alt = item.get("altText") or ""
                ctype = _get_from_alt_text("Type", alt)
                stype = _get_from_alt_text("Super", alt)
                rarity = _get_from_alt_text("Rarity", alt)
                tags = _get_from_alt_text("Tags", alt)
                tags_list = [t.strip() for t in tags.split(",")] if tags else []

                key = (set_code, int(number))
                stats = piltover_stats.get(key)
                if not stats:
                    # keep card in dataset anyway, but stats will be null
                    dataset[card_id] = {
                        "id": card_id,
                        "set": set_code,
                        "number": number,
                        "title": title,
                        "type": ctype.lower() if ctype else None,
                        "super": stype.lower() if stype else None,
                        "rarity": (rarity.lower() if rarity else None),
                        "orientation": orientation,
                        "tags": tags_list,
                        "energy": None,
                        "power": None,
                        "might": None,
                        "color": None,
                    }
                    continue

                dataset[card_id] = {
                    "id": card_id,
                    "set": set_code,
                    "number": number,
                    "title": title,
                    "type": ctype.lower() if ctype else None,
                    "super": stype.lower() if stype else None,
                    "rarity": (rarity.lower() if rarity else None),
                    "orientation": orientation,
                    "tags": tags_list,
                    "energy": stats["energy"],
                    "power": stats["power"],
                    "might": stats["might"],
                    "color": stats["color"],
                }

        out_path.write_text(json.dumps(dataset, indent=2, sort_keys=True))
        print(f"wrote {len(dataset)} cards to {out_path}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="riftbound/backend/data/card_stats.json")
    args = ap.parse_args()
    asyncio.run(main(Path(args.out)))


