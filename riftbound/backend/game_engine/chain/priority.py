from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from ..state import GameState, Player


class PriorityManager:
    
    def __init__(self, state: "GameState"):
        self.state = state
        self.priority_player_id: Optional[str] = None
        self.passed_players: set[str] = set()
    
    def give_priority_to(self, player: "Player"):
        self.priority_player_id = player.id
        self.passed_players.clear()
    
    def has_priority(self, player: "Player") -> bool:
        return self.priority_player_id == player.id
    
    def pass_priority(self, player: "Player"):
        if not self.has_priority(player):
            return False
        
        self.passed_players.add(player.id)
        
        opponent_id = self.state.player2.id if player.id == self.state.player1.id else self.state.player1.id
        
        if opponent_id in self.passed_players:
            return True
        
        self.priority_player_id = opponent_id
        return False
    
    def all_passed(self) -> bool:
        return len(self.passed_players) >= 2
    
    def reset(self):
        self.priority_player_id = None
        self.passed_players.clear()
    
    def __repr__(self):
        return f"PriorityManager(priority={self.priority_player_id}, passed={len(self.passed_players)})"
