from typing import TYPE_CHECKING
from .base import Effect, EffectContext

if TYPE_CHECKING:
    from ..state import Player


class ChannelEffect(Effect):
    
    def __init__(self, amount: int = 1):
        super().__init__()
        self.amount = amount
    
    def requires_target(self) -> bool:
        return False
    
    def can_execute(self, context: EffectContext) -> bool:
        return context.controller is not None
    
    def execute(self, context: EffectContext) -> dict:
        if not context.controller:
            return {"success": False, "error": "no controller specified"}
        
        channeled = 0
        for _ in range(self.amount):
            rune = context.controller.channel_rune()
            if rune:
                channeled += 1
        
        return {
            "success": True,
            "channeled": channeled,
            "requested": self.amount
        }
    
    def __repr__(self):
        return f"ChannelEffect(amount={self.amount})"


class ReadyEffect(Effect):
    
    def __init__(self):
        super().__init__()
    
    def requires_target(self) -> bool:
        return True
    
    def can_execute(self, context: EffectContext) -> bool:
        return context.target_id is not None
    
    def execute(self, context: EffectContext) -> dict:
        if not context.target_id:
            return {"success": False, "error": "no target specified"}
        
        target = self._find_target(context)
        if not target:
            if self.can_partial_resolve:
                return {"success": True, "skipped": True}
            return {"success": False, "error": "target not found"}
        
        target.exhausted = False
        
        return {
            "success": True,
            "target": target.title if hasattr(target, "title") else "unit"
        }
    
    def _find_target(self, context: EffectContext):
        for bf in context.state.battlefields:
            for unit in bf.player1_units + bf.player2_units:
                if unit.instance_id == context.target_id:
                    return unit
        
        for player in [context.state.player1, context.state.player2]:
            for unit in player.base_units:
                if unit.instance_id == context.target_id:
                    return unit
            for gear in player.base_gear:
                if gear.instance_id == context.target_id:
                    return gear
            for rune in player.channeled_runes:
                if rune.instance_id == context.target_id:
                    return rune
        
        return None
    
    def __repr__(self):
        return "ReadyEffect()"


class ExhaustEffect(Effect):
    
    def __init__(self):
        super().__init__()
    
    def requires_target(self) -> bool:
        return True
    
    def can_execute(self, context: EffectContext) -> bool:
        return context.target_id is not None
    
    def execute(self, context: EffectContext) -> dict:
        if not context.target_id:
            return {"success": False, "error": "no target specified"}
        
        target = self._find_target(context)
        if not target:
            if self.can_partial_resolve:
                return {"success": True, "skipped": True}
            return {"success": False, "error": "target not found"}
        
        target.exhausted = True
        
        return {
            "success": True,
            "target": target.title if hasattr(target, "title") else "unit"
        }
    
    def _find_target(self, context: EffectContext):
        for bf in context.state.battlefields:
            for unit in bf.player1_units + bf.player2_units:
                if unit.instance_id == context.target_id:
                    return unit
        
        for player in [context.state.player1, context.state.player2]:
            for unit in player.base_units:
                if unit.instance_id == context.target_id:
                    return unit
            for gear in player.base_gear:
                if gear.instance_id == context.target_id:
                    return gear
            for rune in player.channeled_runes:
                if rune.instance_id == context.target_id:
                    return rune
        
        return None
    
    def __repr__(self):
        return "ExhaustEffect()"
