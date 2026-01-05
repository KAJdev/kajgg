"""
websocket gateway for real-time game communication.
handles player connections and game command routing.
"""
import json
import logging
from sanic import Blueprint
from sanic.server.websockets.impl import WebsocketImplProtocol

from modules import games

bp = Blueprint("gateway", url_prefix="/ws")
logger = logging.getLogger("gateway")


@bp.websocket("/game/<game_id:str>")
async def game_socket(request, ws: WebsocketImplProtocol, game_id: str):
    """websocket connection for a game"""
    player_id = request.args.get("playerId")
    
    if not player_id:
        await ws.send(json.dumps({"type": "error", "message": "playerId required"}))
        await ws.close()
        return
    
    session = games.get_game(game_id)
    if not session:
        await ws.send(json.dumps({"type": "error", "message": "game not found"}))
        await ws.close()
        return
    
    # verify player is in this game
    if player_id != session.player1_id and player_id != session.player2_id:
        await ws.send(json.dumps({"type": "error", "message": "not a player in this game"}))
        await ws.close()
        return
    
    # register connection
    session.connections[player_id] = ws
    
    if player_id == session.player1_id:
        session.player1_connected = True
    else:
        session.player2_connected = True
    
    logger.info(f"player {player_id} connected to game {game_id}")
    
    # send initial game state
    await ws.send(json.dumps({
        "type": "game_state",
        "state": session.to_dict(for_player=player_id),
    }))
    
    # notify other player
    await broadcast_to_game(session, {
        "type": "player_joined",
        "player": {
            "id": player_id,
            "connected": True,
        },
    }, exclude=player_id)

    if session.status == "active" and session.state:
        for pid, conn in list(session.connections.items()):
            try:
                await conn.send(json.dumps({
                    "type": "game_state",
                    "state": session.to_dict(for_player=pid),
                }))
            except Exception as e:
                logger.error(f"failed to send state to {pid}: {e}")
    
    # register engine event handler
    if session.engine:
        async def on_engine_event(event_type: str, data: dict):
            await broadcast_to_game(session, {
                "type": event_type,
                **data,
            })
        session.engine.on_event(lambda t, d: request.app.add_task(on_engine_event(t, d)))
    
    try:
        async for message in ws:
            try:
                command = json.loads(message)
                await handle_command(session, player_id, command)
            except json.JSONDecodeError:
                await ws.send(json.dumps({
                    "type": "error",
                    "message": "invalid json",
                }))
            except Exception as e:
                logger.error(f"error handling command: {e}")
                await ws.send(json.dumps({
                    "type": "error",
                    "message": str(e),
                }))
    finally:
        # cleanup on disconnect
        session.connections.pop(player_id, None)
        
        if player_id == session.player1_id:
            session.player1_connected = False
        else:
            session.player2_connected = False
        
        logger.info(f"player {player_id} disconnected from game {game_id}")
        
        # notify other player
        await broadcast_to_game(session, {
            "type": "player_left",
            "playerId": player_id,
        })


async def handle_command(session: games.GameSession, player_id: str, command: dict):
    """handle a game command from a player"""
    if not session.engine:
        await send_to_player(session, player_id, {
            "type": "error",
            "message": "game not started",
        })
        return
    
    result = session.engine.process_command(player_id, command)
    
    if result.get("success"):
        # broadcast updated game state to all players
        for pid, ws in session.connections.items():
            try:
                await ws.send(json.dumps({
                    "type": "game_state",
                    "state": session.to_dict(for_player=pid),
                }))
            except Exception as e:
                logger.error(f"failed to send to {pid}: {e}")
    else:
        # send error to requesting player
        await send_to_player(session, player_id, {
            "type": "error",
            "message": result.get("error", "command failed"),
        })


async def send_to_player(session: games.GameSession, player_id: str, data: dict):
    """send a message to a specific player"""
    ws = session.connections.get(player_id)
    if ws:
        try:
            await ws.send(json.dumps(data))
        except Exception as e:
            logger.error(f"failed to send to {player_id}: {e}")


async def broadcast_to_game(session: games.GameSession, data: dict, exclude: str = None):
    """broadcast a message to all players in a game"""
    for player_id, ws in session.connections.items():
        if player_id == exclude:
            continue
        try:
            await ws.send(json.dumps(data))
        except Exception as e:
            logger.error(f"failed to send to {player_id}: {e}")

