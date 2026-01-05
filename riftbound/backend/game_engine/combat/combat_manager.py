from typing import TYPE_CHECKING, Optional, Callable, List
from .damage_calc import DamageCalculator

if TYPE_CHECKING:
    from ..state import GameState, Battlefield, CardInstance


class CombatManager:
    
    def __init__(self, state: "GameState"):
        self.state = state
        self._emit_callback: Optional[Callable] = None
    
    def set_emit_callback(self, callback: Callable):
        self._emit_callback = callback
    
    def _emit(self, event_type: str, data: dict):
        if self._emit_callback:
            self._emit_callback(event_type, data)
    
    def resolve_combat(self, battlefield: "Battlefield"):
        self._emit("combat_started", {
            "battlefield": battlefield.instance_id,
            "title": battlefield.title
        })
        
        player1_units = battlefield.player1_units
        player2_units = battlefield.player2_units
        
        if not player1_units or not player2_units:
            self._emit("combat_no_defenders", {"battlefield": battlefield.instance_id})
            return
        
        total_p1_might = sum(DamageCalculator.calculate_might(u, "attacking") for u in player1_units)
        total_p2_might = sum(DamageCalculator.calculate_might(u, "attacking") for u in player2_units)
        
        self._emit("combat_damage_calculated", {
            "battlefield": battlefield.instance_id,
            "player1_might": total_p1_might,
            "player2_might": total_p2_might
        })
        
        destroyed_units: List["CardInstance"] = []
        
        for unit in player1_units:
            was_destroyed = unit.take_damage(total_p2_might)
            if was_destroyed:
                destroyed_units.append(unit)
        
        for unit in player2_units:
            was_destroyed = unit.take_damage(total_p1_might)
            if was_destroyed:
                destroyed_units.append(unit)
        
        for unit in destroyed_units:
            battlefield.remove_unit(unit.instance_id)
            owner = self.state.get_player(unit.owner_id)
            if owner:
                owner.graveyard.append(unit)
                self._emit("unit_destroyed", {
                    "unit": unit.title,
                    "owner": owner.id
                })
        
        remaining_p1 = len(battlefield.player1_units)
        remaining_p2 = len(battlefield.player2_units)
        
        if remaining_p1 > 0 and remaining_p2 == 0:
            battlefield.controller = self.state.player1.id
            self._emit("combat_control_changed", {
                "battlefield": battlefield.instance_id,
                "controller": self.state.player1.id
            })
        elif remaining_p2 > 0 and remaining_p1 == 0:
            battlefield.controller = self.state.player2.id
            self._emit("combat_control_changed", {
                "battlefield": battlefield.instance_id,
                "controller": self.state.player2.id
            })
        
        self._emit("combat_ended", {"battlefield": battlefield.instance_id})
