from typing import TYPE_CHECKING
from .base import Effect, EffectContext
from .targeting import Target, TargetSelector

if TYPE_CHECKING:
    from ..state import CardInstance


class KillEffect(Effect):
    
    def __init__(self, target: Target = Target.UNIT):
        super().__init__()
        self.target = target
    
    def requires_target(self) -> bool:
        return self.target not in [Target.ALL_UNITS, Target.ALL_ENEMY_UNITS, Target.ALL_FRIENDLY_UNITS]
    
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
        if self.target in [Target.ALL_UNITS, Target.ALL_ENEMY_UNITS, Target.ALL_FRIENDLY_UNITS]:
            targets = TargetSelector.get_valid_targets(
                context.state,
                self.target,
                context.controller
            )
            
            for target_unit in targets:
                self._destroy_unit(context.state, target_unit)
            
            return {
                "success": True,
                "destroyed": len(targets)
            }
        
        if not context.target_id:
            return {"success": False, "error": "no target specified"}
        
        target_unit = None
        for bf in context.state.battlefields:
            for unit in bf.player1_units + bf.player2_units:
                if unit.instance_id == context.target_id:
                    target_unit = unit
                    break
            if target_unit:
                break
        
        if not target_unit:
            for player in [context.state.player1, context.state.player2]:
                for unit in player.base_units:
                    if unit.instance_id == context.target_id:
                        target_unit = unit
                        break
                if target_unit:
                    break
        
        if not target_unit:
            if self.can_partial_resolve:
                return {"success": True, "skipped": True}
            return {"success": False, "error": "target not found"}
        
        self._destroy_unit(context.state, target_unit)
        
        return {
            "success": True,
            "target": target_unit.title,
            "destroyed": True
        }
    
    def _destroy_unit(self, state, unit: "CardInstance"):
        for bf in state.battlefields:
            bf.remove_unit(unit.instance_id)
        
        for player in [state.player1, state.player2]:
            if unit in player.base_units:
                player.base_units.remove(unit)
        
        owner = state.get_player(unit.owner_id)
        if owner:
            owner.graveyard.append(unit)
    
    def __repr__(self):
        return f"KillEffect(target={self.target.value})"
