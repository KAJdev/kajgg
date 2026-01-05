from typing import TYPE_CHECKING, Optional
from .base import Effect, EffectContext
from .targeting import Target, TargetSelector

if TYPE_CHECKING:
    from ..state import CardInstance


class DamageEffect(Effect):
    
    def __init__(self, amount: int, target: Target = Target.UNIT_AT_BATTLEFIELD):
        super().__init__()
        self.amount = amount
        self.target = target
        self.killed_target = False
    
    def requires_target(self) -> bool:
        return self.target in [
            Target.UNIT,
            Target.UNIT_AT_BATTLEFIELD,
            Target.UNIT_AT_BASE,
            Target.ANY_UNIT,
            Target.PLAYER,
        ]
    
    def can_execute(self, context: EffectContext) -> bool:
        if self.requires_target():
            return context.target_id is not None
        return True
    
    def get_valid_targets(self, context: EffectContext) -> list[str]:
        targets = TargetSelector.get_valid_targets(
            context.state,
            self.target,
            context.controller
        )
        return [t.instance_id for t in targets]
    
    def execute(self, context: EffectContext) -> dict:
        if not self.can_execute(context):
            return {"success": False, "error": "cannot execute damage effect"}
        
        if self.target in [Target.ALL_UNITS, Target.ALL_UNITS_AT_BATTLEFIELD]:
            targets = TargetSelector.get_valid_targets(
                context.state,
                self.target,
                context.controller
            )
            destroyed_units = []
            for target_unit in targets:
                was_destroyed = target_unit.take_damage(self.amount)
                if was_destroyed:
                    destroyed_units.append(target_unit)
                    self._remove_unit_from_board(context.state, target_unit)
            
            return {
                "success": True,
                "amount": self.amount,
                "targets": len(targets),
                "destroyed": len(destroyed_units)
            }
        
        target_unit = self._find_target_unit(context)
        if not target_unit:
            if self.can_partial_resolve:
                return {"success": True, "skipped": True}
            return {"success": False, "error": "target not found"}
        
        was_destroyed = target_unit.take_damage(self.amount)
        self.killed_target = was_destroyed
        
        if was_destroyed:
            self._remove_unit_from_board(context.state, target_unit)
        
        return {
            "success": True,
            "amount": self.amount,
            "target": target_unit.title,
            "destroyed": was_destroyed
        }
    
    def _find_target_unit(self, context: EffectContext) -> Optional["CardInstance"]:
        for bf in context.state.battlefields:
            for unit in bf.player1_units + bf.player2_units:
                if unit.instance_id == context.target_id:
                    return unit
        
        for unit in context.state.player1.base_units + context.state.player2.base_units:
            if unit.instance_id == context.target_id:
                return unit
        
        return None
    
    def _remove_unit_from_board(self, state, unit: "CardInstance"):
        for bf in state.battlefields:
            bf.remove_unit(unit.instance_id)
        
        for player in [state.player1, state.player2]:
            if unit in player.base_units:
                player.base_units.remove(unit)
        
        owner = state.get_player(unit.owner_id)
        if owner:
            owner.graveyard.append(unit)
    
    def __repr__(self):
        return f"DamageEffect(amount={self.amount}, target={self.target.value})"
