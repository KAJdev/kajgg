from typing import TYPE_CHECKING
from .base import Trigger, TriggerType, TriggerEvent

if TYPE_CHECKING:
    from ..state import GameState
    from ..effects.base import Effect


class ConquerTrigger(Trigger):
    
    def __init__(self, effect: "Effect"):
        super().__init__(effect, TriggerType.CONQUER)
    
    def should_trigger(self, event: TriggerEvent, state: "GameState") -> bool:
        return event.trigger_type == TriggerType.CONQUER
    
    def __repr__(self):
        return f"ConquerTrigger(effect={self.effect})"


class HoldTrigger(Trigger):
    
    def __init__(self, effect: "Effect"):
        super().__init__(effect, TriggerType.HOLD)
    
    def should_trigger(self, event: TriggerEvent, state: "GameState") -> bool:
        return event.trigger_type == TriggerType.HOLD
    
    def __repr__(self):
        return f"HoldTrigger(effect={self.effect})"


class AttackTrigger(Trigger):
    
    def __init__(self, effect: "Effect"):
        super().__init__(effect, TriggerType.ATTACK)
    
    def should_trigger(self, event: TriggerEvent, state: "GameState") -> bool:
        return event.trigger_type == TriggerType.ATTACK
    
    def __repr__(self):
        return f"AttackTrigger(effect={self.effect})"


class DefendTrigger(Trigger):
    
    def __init__(self, effect: "Effect"):
        super().__init__(effect, TriggerType.DEFEND)
    
    def should_trigger(self, event: TriggerEvent, state: "GameState") -> bool:
        return event.trigger_type == TriggerType.DEFEND
    
    def __repr__(self):
        return f"DefendTrigger(effect={self.effect})"
