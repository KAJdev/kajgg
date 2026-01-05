"""
card api endpoints.
provides card data for the frontend.
"""
from sanic import Blueprint
from sanic.response import json

from modules import cards

bp = Blueprint("cards", url_prefix="/api/cards")


@bp.get("/")
async def get_all_cards(request):
    """get all available cards"""
    all_cards = cards.get_all_cards()
    return json([card.to_dict() for card in all_cards])


@bp.get("/<card_id:str>")
async def get_card(request, card_id: str):
    """get a specific card by id"""
    card = cards.get_card(card_id)
    if not card:
        return json({"error": "card not found"}, status=404)
    return json(card.to_dict())


@bp.get("/search")
async def search_cards(request):
    """search cards by title or tags"""
    query = request.args.get("q", "")
    if not query:
        return json([])
    
    results = cards.search_cards(query)
    return json([card.to_dict() for card in results])

