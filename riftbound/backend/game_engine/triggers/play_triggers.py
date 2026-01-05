from typing import TYPE_CHECKING, Optional
from .base import Trigger, TriggerType, TriggerEvent

if TYPE_CHECKING:
    from ..state import GameState
    from ..effects.base import Effect


class PlayTrigger(Trigger):
    
    def __init__(self, effect: "Effect"):
        super().__init__(effect, TriggerType.PLAY)
    
    def should_trigger(self, event: TriggerEvent, state: "GameState") -> bool:
        return event.trigger_type == TriggerType.PLAY
    
    def __repr__(self):
        return f"PlayTrigger(effect={self.effect})"


class DiscardTrigger(Trigger):
    
    def __init__(self, effect: "Effect", pay_cost: Optional[int] = None):
        super().__init__(effect, TriggerType.DISCARD)
        self.pay_cost = pay_cost
    
    def should_trigger(self, event: TriggerEvent, state: "GameState") -> bool:
        if event.trigger_type != TriggerType.DISCARD:
            return False
        
        if self.pay_cost is not None:
            if event.player_id:
                player = state.get_player(event.player_id)
                if player:
                    available_energy = sum(1 for r in player.channeled_runes if not r.exhausted)
                    return available_energy >= self.pay_cost
            return False
        
        return True
    
    def __repr__(self):
        cost_str = f", cost={self.pay_cost}" if self.pay_cost is not None else ""
        return f"DiscardTrigger(effect={self.effect}{cost_str})"
