from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any


def _repo_root() -> Path:
    # .../riftbound/backend/scripts -> .../ (repo root)
    return Path(__file__).resolve().parents[3]


async def main(out_path: Path, *, max_seconds: int, max_pages: int):
    # allow importing /riftbound/cards.py as riftbound.cards
    sys.path.insert(0, str(_repo_root()))

    # local import so sys.path is already set
    import riftbound.cards as rb_cards  # type: ignore

    # keep the scrape bounded so it never "hangs forever"
    rb_cards.PILTOVER_MAX_PAGES = max_pages
    get_cards = rb_cards.get_cards

    out_path.parent.mkdir(parents=True, exist_ok=True)

    def _val(x: Any):
        # supports both Enum-like and plain strings
        return getattr(x, "value", x)

    dataset: dict[str, dict] = {}
    for set_code in ["OGN", "OGS"]:
        print(
            f"[export] fetching {set_code} (max_pages={max_pages}, timeout={max_seconds}s)"
        )
        cards = await asyncio.wait_for(get_cards(set_code), timeout=max_seconds)
        for c in cards:
            dataset[c.id] = {
                "id": c.id,
                "set": c.set,
                "number": c.number,
                "title": c.title,
                "type": _val(c.type) if c.type else None,
                "super": _val(c.super) if c.super else None,
                "orientation": _val(c.orientation),
                "rarity": _val(c.rarity),
                "tags": c.tags,
                "color": _val(c.color) if c.color else None,
                "energy": c.energy,
                "power": c.power,
                "might": c.might,
                "text": c.text,
            }

    out_path.write_text(json.dumps(dataset, indent=2, sort_keys=True))
    print(f"wrote {len(dataset)} cards to {out_path}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--out",
        default=str(
            _repo_root() / "riftbound" / "backend" / "data" / "card_stats.json"
        ),
    )
    ap.add_argument("--timeout-seconds", type=int, default=90)
    ap.add_argument("--max-pages", type=int, default=30)
    args = ap.parse_args()
    asyncio.run(
        main(Path(args.out), max_seconds=args.timeout_seconds, max_pages=args.max_pages)
    )
