"""
game session management.
handles creating, joining, and managing game instances.
"""
import random
import string
from dataclasses import dataclass, field
from datetime import datetime, UTC
from typing import Optional
from cuid2 import cuid_wrapper

from game_engine.state import GameState, Player, create_initial_state
from game_engine.engine import GameEngine

generate_id = cuid_wrapper()

# game session storage
_games: dict[str, "GameSession"] = {}
_codes: dict[str, str] = {}  # code -> game_id


def generate_code() -> str:
    """generate a 6 character game code"""
    chars = string.ascii_uppercase.replace("O", "").replace("I", "") + "23456789"
    return "".join(random.choices(chars, k=6))


@dataclass
class GameSession:
    id: str
    code: str
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    
    player1_id: Optional[str] = None
    player1_name: Optional[str] = None
    player1_deck: Optional[dict] = None
    player1_connected: bool = False
    
    player2_id: Optional[str] = None
    player2_name: Optional[str] = None
    player2_deck: Optional[dict] = None
    player2_connected: bool = False
    
    # game state and engine
    state: Optional[GameState] = None
    engine: Optional[GameEngine] = None
    
    # websocket connections
    connections: dict = field(default_factory=dict)
    
    @property
    def status(self) -> str:
        if self.finished_at:
            return "finished"
        if self.started_at:
            return "active"
        return "waiting"
    
    def can_start(self) -> bool:
        return (
            self.player1_id is not None and
            self.player2_id is not None and
            self.player1_deck is not None and
            self.player2_deck is not None and
            self.status == "waiting"
        )
    
    def start(self):
        """start the game"""
        if not self.can_start():
            raise ValueError("cannot start game: missing players or decks")
        
        self.started_at = datetime.now(UTC)
        self.state = create_initial_state(
            game_id=self.id,
            code=self.code,
            player1_id=self.player1_id,
            player1_name=self.player1_name,
            player1_deck=self.player1_deck,
            player2_id=self.player2_id,
            player2_name=self.player2_name,
            player2_deck=self.player2_deck,
        )
        self.engine = GameEngine(self.state)
        # note: setup is handled via websocket setup commands (battlefield pick -> mulligan)
    
    def to_dict(self, for_player: Optional[str] = None) -> dict:
        """convert to dict for api response"""
        return {
            "id": self.id,
            "code": self.code,
            "status": self.status,
            "player1": self._player_dict(1, for_player),
            "player2": self._player_dict(2, for_player),
            "battlefields": [bf.to_dict() for bf in self.state.battlefields] if self.state else [],
            "currentTurn": self.state.current_turn if self.state else None,
            "turnNumber": self.state.turn_number if self.state else 0,
            "phase": self.state.phase.value if self.state else None,
            "chainItems": self.state.chain_items if self.state else [],
            "priorityPlayer": self.state.priority_player if self.state else None,
            "waitingForResponse": self.state.waiting_for_response if self.state else False,
            "setup": {
                "step": self.state.setup_step,
                "mulliganPlayer": self.state.mulligan_player,
                "battlefieldOptions": self.state.battlefield_options,
                "battlefieldSelected": self.state.battlefield_selected,
            } if self.state else None,
            "actionLog": [a.to_dict() for a in self.state.action_log[-50:]] if self.state else [],  # last 50 actions
            "winner": self.state.winner if self.state else None,
            "createdAt": self.created_at.isoformat(),
            "startedAt": self.started_at.isoformat() if self.started_at else None,
            "finishedAt": self.finished_at.isoformat() if self.finished_at else None,
        }
    
    def _player_dict(self, player_num: int, for_player: Optional[str]) -> Optional[dict]:
        """get player dict, hiding opponent's hand"""
        player_id = self.player1_id if player_num == 1 else self.player2_id
        player_name = self.player1_name if player_num == 1 else self.player2_name
        connected = self.player1_connected if player_num == 1 else self.player2_connected
        
        if not player_id:
            return None
        
        player_state = None
        if self.state:
            player_state = self.state.player1 if player_num == 1 else self.state.player2
        
        is_self = for_player == player_id
        
        result = {
            "id": player_id,
            "name": player_name,
            "position": f"player{player_num}",
            "connected": connected,
            "score": player_state.score if player_state else 0,
        }
        
        if player_state:
            result.update({
                "mainDeckSize": len(player_state.main_deck),
                "runeDeckSize": len(player_state.rune_deck),
                "handSize": len(player_state.hand),
                "hand": [c.to_dict() for c in player_state.hand] if is_self else [],
                "runesInPlay": [r.to_dict() for r in player_state.runes_in_play],
                "energy": player_state.get_energy(),
                "baseUnits": [c.to_dict() for c in player_state.base_units],
                "baseGear": [c.to_dict() for c in player_state.base_gear],
                "graveyard": [c.to_dict() for c in player_state.graveyard],
                "champion": player_state.champion.to_dict() if player_state.champion else None,
            })
        
        return result


def init():
    """initialize the game manager"""
    pass


def create_game(player_id: str, player_name: str, deck: dict) -> GameSession:
    """create a new game session"""
    game_id = generate_id()
    code = generate_code()
    
    while code in _codes:
        code = generate_code()
    
    session = GameSession(
        id=game_id,
        code=code,
        created_at=datetime.now(UTC),
        player1_id=player_id,
        player1_name=player_name,
        player1_deck=deck,
    )
    
    _games[game_id] = session
    _codes[code] = game_id
    
    return session


def join_game(code: str, player_id: str, player_name: str, deck: dict) -> GameSession:
    """join an existing game by code"""
    code = code.upper()
    
    if code not in _codes:
        raise ValueError("game not found")
    
    game_id = _codes[code]
    session = _games.get(game_id)
    
    if not session:
        raise ValueError("game not found")
    
    if session.status != "waiting":
        raise ValueError("game already started")
    
    if session.player2_id:
        raise ValueError("game is full")
    
    session.player2_id = player_id
    session.player2_name = player_name
    session.player2_deck = deck
    
    # start the game
    session.start()
    
    return session


def get_game(game_id: str) -> Optional[GameSession]:
    return _games.get(game_id)


def get_game_by_code(code: str) -> Optional[GameSession]:
    code = code.upper()
    game_id = _codes.get(code)
    return _games.get(game_id) if game_id else None


def remove_game(game_id: str):
    session = _games.pop(game_id, None)
    if session:
        _codes.pop(session.code, None)
