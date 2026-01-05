"""
game api endpoints.
handles game creation, joining, and state retrieval.
"""
import json
from sanic import Blueprint
from sanic.response import json as json_response

from modules import games

bp = Blueprint("games", url_prefix="/api/games")


@bp.post("/")
async def create_game(request):
    """create a new game"""
    data = request.json
    
    player_name = data.get("playerName")
    deck = data.get("deck")
    
    if not player_name:
        return json_response({"error": "playerName required"}, status=400)
    if not deck:
        return json_response({"error": "deck required"}, status=400)
    
    # use player name as id for now (would use auth in production)
    player_id = player_name.lower().replace(" ", "_")
    
    try:
        session = games.create_game(player_id, player_name, deck)
        return json_response({
            "gameId": session.id,
            "code": session.code,
            "playerId": player_id,
        })
    except Exception as e:
        return json_response({"error": str(e)}, status=400)


@bp.post("/join")
async def join_game(request):
    """join an existing game"""
    data = request.json
    
    code = data.get("code")
    player_name = data.get("playerName")
    deck = data.get("deck")
    
    if not code:
        return json_response({"error": "code required"}, status=400)
    if not player_name:
        return json_response({"error": "playerName required"}, status=400)
    if not deck:
        return json_response({"error": "deck required"}, status=400)
    
    player_id = player_name.lower().replace(" ", "_")
    
    try:
        session = games.join_game(code, player_id, player_name, deck)
        
        # notify player 1 that player 2 has joined and game has started
        # this is the critical fix - broadcast to existing websocket connections fr
        if session.connections:
            game_started_msg = json.dumps({
                "type": "game_started",
                "state": session.to_dict(for_player=session.player1_id),
            })
            
            for pid, ws in list(session.connections.items()):
                try:
                    await ws.send(game_started_msg if pid == session.player1_id else json.dumps({
                        "type": "game_started", 
                        "state": session.to_dict(for_player=pid),
                    }))
                except Exception as e:
                    print(f"failed to notify {pid}: {e}")
        
        return json_response({
            "gameId": session.id,
            "playerId": player_id,
        })
    except ValueError as e:
        return json_response({"error": str(e)}, status=400)
    except Exception as e:
        return json_response({"error": str(e)}, status=500)


@bp.get("/<game_id:str>")
async def get_game(request, game_id: str):
    """get game state"""
    session = games.get_game(game_id)
    if not session:
        return json_response({"error": "game not found"}, status=404)
    
    # get player id from query param or header
    player_id = request.args.get("playerId")
    
    return json_response(session.to_dict(for_player=player_id))
