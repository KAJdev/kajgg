from typing import TYPE_CHECKING, Optional
from .base import Trigger, TriggerType, TriggerEvent

if TYPE_CHECKING:
    from ..state import GameState, GamePhase
    from ..effects.base import Effect


class PhaseStartTrigger(Trigger):
    
    def __init__(self, effect: "Effect", phase: Optional[str] = None):
        super().__init__(effect, TriggerType.PHASE_START)
        self.phase = phase
    
    def should_trigger(self, event: TriggerEvent, state: "GameState") -> bool:
        if event.trigger_type != TriggerType.PHASE_START:
            return False
        
        if self.phase:
            return event.phase == self.phase
        
        return True
    
    def __repr__(self):
        phase_str = f", phase={self.phase}" if self.phase else ""
        return f"PhaseStartTrigger(effect={self.effect}{phase_str})"


class PhaseEndTrigger(Trigger):
    
    def __init__(self, effect: "Effect", phase: Optional[str] = None):
        super().__init__(effect, TriggerType.PHASE_END)
        self.phase = phase
    
    def should_trigger(self, event: TriggerEvent, state: "GameState") -> bool:
        if event.trigger_type != TriggerType.PHASE_END:
            return False
        
        if self.phase:
            return event.phase == self.phase
        
        return True
    
    def __repr__(self):
        phase_str = f", phase={self.phase}" if self.phase else ""
        return f"PhaseEndTrigger(effect={self.effect}{phase_str})"
