"""
deck api endpoints.
handles deck validation and parsing.
"""
from sanic import Blueprint
from sanic.response import json

from modules import cards

bp = Blueprint("decks", url_prefix="/api/decks")

# deck rules
MAIN_DECK_SIZE = 40
RUNE_DECK_SIZE = 12
MAX_COPIES = 3
MAX_COPIES_CHAMPION = 1


@bp.post("/validate")
async def validate_deck(request):
    """validate and parse a deck list"""
    data = request.json
    text = data.get("text", "")
    
    if not text:
        return json({
            "valid": False,
            "errors": ["no deck list provided"],
        })
    
    errors = []
    warnings = []
    main_deck = []
    rune_deck = []
    
    lines = text.strip().split("\n")
    current_section = "main"
    
    for line in lines:
        line = line.strip()
        
        # skip empty lines and comments
        if not line or line.startswith("#") or line.startswith("//"):
            continue
        
        # check for section headers
        if "rune" in line.lower():
            current_section = "rune"
            continue
        if "main" in line.lower():
            current_section = "main"
            continue
        
        # parse card entry
        # formats: "3x Card Name", "3 Card Name", "Card Name x3"
        count = 1
        card_name = line
        
        import re
        match = re.match(r"^(\d+)x?\s+(.+)$", line) or re.match(r"^(.+?)\s*x(\d+)$", line)
        if match:
            groups = match.groups()
            if groups[0].isdigit():
                count = int(groups[0])
                card_name = groups[1].strip()
            else:
                card_name = groups[0].strip()
                count = int(groups[1])
        
        # find the card
        found_card = None
        for card in cards.get_all_cards():
            if card.title.lower() == card_name.lower():
                found_card = card
                break
        
        if not found_card:
            # try partial match
            for card in cards.get_all_cards():
                if card_name.lower() in card.title.lower():
                    found_card = card
                    warnings.append(f"matched '{card_name}' to '{card.title}'")
                    break
        
        if not found_card:
            errors.append(f"card not found: {card_name}")
            continue
        
        # check copy limits
        max_copies = MAX_COPIES_CHAMPION if found_card.super_type == "champion" else MAX_COPIES
        if count > max_copies:
            errors.append(f"{found_card.title}: max {max_copies} copies allowed")
        
        entry = {
            "cardId": found_card.id,
            "count": count,
            "card": found_card.to_dict(),
        }
        
        if current_section == "rune":
            rune_deck.append(entry)
        else:
            main_deck.append(entry)
    
    # check deck sizes
    main_count = sum(e["count"] for e in main_deck)
    rune_count = sum(e["count"] for e in rune_deck)
    
    if main_count != MAIN_DECK_SIZE:
        errors.append(f"main deck must have {MAIN_DECK_SIZE} cards (has {main_count})")
    
    if rune_count != RUNE_DECK_SIZE:
        errors.append(f"rune deck must have {RUNE_DECK_SIZE} cards (has {rune_count})")
    
    deck = {
        "id": "",
        "name": "imported deck",
        "mainDeck": main_deck,
        "runeDeck": rune_deck,
        "createdAt": "",
        "updatedAt": "",
    }
    
    return json({
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "deck": deck if len(errors) == 0 else None,
    })

