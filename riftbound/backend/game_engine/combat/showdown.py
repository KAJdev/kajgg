from typing import TYPE_CHECKING, Optional, Callable
from .damage_calc import DamageCalculator

if TYPE_CHECKING:
    from ..state import GameState, Battlefield, Player


class ShowdownManager:
    
    def __init__(self, state: "GameState"):
        self.state = state
        self._emit_callback: Optional[Callable] = None
    
    def set_emit_callback(self, callback: Callable):
        self._emit_callback = callback
    
    def _emit(self, event_type: str, data: dict):
        if self._emit_callback:
            self._emit_callback(event_type, data)
    
    def initiate_showdown(self, battlefield: "Battlefield"):
        self._emit("showdown_started", {
            "battlefield": battlefield.instance_id,
            "title": battlefield.title
        })
        
        player1_units = battlefield.player1_units
        player2_units = battlefield.player2_units
        
        if not player1_units and not player2_units:
            self._emit("showdown_no_units", {"battlefield": battlefield.instance_id})
            return
        
        if not player1_units:
            battlefield.controller = self.state.player2.id
            self._emit("showdown_control_changed", {
                "battlefield": battlefield.instance_id,
                "controller": self.state.player2.id
            })
            return
        
        if not player2_units:
            battlefield.controller = self.state.player1.id
            self._emit("showdown_control_changed", {
                "battlefield": battlefield.instance_id,
                "controller": self.state.player1.id
            })
            return
        
        self._emit("showdown_ended", {"battlefield": battlefield.instance_id})
