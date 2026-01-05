from typing import TYPE_CHECKING, Optional, Callable

if TYPE_CHECKING:
    from ..state import GameState


class ControlManager:
    
    def __init__(self, state: "GameState"):
        self.state = state
        self._emit_callback: Optional[Callable] = None
    
    def set_emit_callback(self, callback: Callable):
        self._emit_callback = callback
    
    def _emit(self, event_type: str, data: dict):
        if self._emit_callback:
            self._emit_callback(event_type, data)
    
    def calculate_control_score(self, player_id: str) -> int:
        score = 0
        
        for battlefield in self.state.battlefields:
            if battlefield.controller == player_id:
                score += 1
        
        return score
    
    def update_battlefield_control(self):
        for battlefield in self.state.battlefields:
            player1_units = battlefield.player1_units
            player2_units = battlefield.player2_units
            
            if len(player1_units) > 0 and len(player2_units) == 0:
                if battlefield.controller != self.state.player1.id:
                    battlefield.controller = self.state.player1.id
                    self._emit("control_changed", {
                        "battlefield": battlefield.instance_id,
                        "controller": self.state.player1.id
                    })
            
            elif len(player2_units) > 0 and len(player1_units) == 0:
                if battlefield.controller != self.state.player2.id:
                    battlefield.controller = self.state.player2.id
                    self._emit("control_changed", {
                        "battlefield": battlefield.instance_id,
                        "controller": self.state.player2.id
                    })
            
            elif len(player1_units) > 0 and len(player2_units) > 0:
                if battlefield.controller is not None:
                    battlefield.controller = None
                    self._emit("control_contested", {
                        "battlefield": battlefield.instance_id
                    })
