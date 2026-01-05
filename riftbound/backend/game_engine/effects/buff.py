from typing import TYPE_CHECKING, Optional
from .base import Effect, EffectContext
from .targeting import Target, TargetSelector

if TYPE_CHECKING:
    from ..state import CardInstance


class BuffEffect(Effect):
    
    def __init__(
        self,
        might_bonus: int = 0,
        attack_bonus: int = 0,
        target: Target = Target.UNIT,
        duration: str = "this_turn",
        keyword: Optional[str] = None
    ):
        super().__init__()
        self.might_bonus = might_bonus
        self.attack_bonus = attack_bonus
        self.target = target
        self.duration = duration
        self.keyword = keyword
    
    def requires_target(self) -> bool:
        return self.target not in [Target.ALL_UNITS, Target.ALL_FRIENDLY_UNITS, Target.ALL_ENEMY_UNITS]
    
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
            return {"success": False, "error": "cannot execute buff effect"}
        
        modifier = {
            "type": "buff",
            "might": self.might_bonus,
            "attack": self.attack_bonus,
            "duration": self.duration,
            "source": context.source_card.instance_id if context.source_card else None
        }
        
        if self.keyword:
            modifier["keyword"] = self.keyword
        
        if self.target in [Target.ALL_UNITS, Target.ALL_FRIENDLY_UNITS, Target.ALL_ENEMY_UNITS]:
            targets = TargetSelector.get_valid_targets(
                context.state,
                self.target,
                context.controller
            )
            for target_unit in targets:
                target_unit.modifiers.append(modifier.copy())
            
            return {
                "success": True,
                "targets": len(targets),
                "might_bonus": self.might_bonus,
                "attack_bonus": self.attack_bonus
            }
        
        target_unit = self._find_target_unit(context)
        if not target_unit:
            if self.can_partial_resolve:
                return {"success": True, "skipped": True}
            return {"success": False, "error": "target not found"}
        
        target_unit.modifiers.append(modifier)
        
        return {
            "success": True,
            "target": target_unit.title,
            "might_bonus": self.might_bonus,
            "attack_bonus": self.attack_bonus
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
    
    def __repr__(self):
        return f"BuffEffect(might={self.might_bonus}, attack={self.attack_bonus}, target={self.target.value})"
