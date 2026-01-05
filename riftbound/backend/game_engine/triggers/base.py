from typing import TYPE_CHECKING, Optional
from dataclasses import dataclass
from abc import ABC, abstractmethod
from enum import Enum

if TYPE_CHECKING:
    from ..state import GameState, CardInstance
    from ..effects.base import Effect


class TriggerType(str, Enum):
    PLAY = "play"
    DISCARD = "discard"
    CONQUER = "conquer"
    HOLD = "hold"
    ATTACK = "attack"
    DEFEND = "defend"
    PHASE_START = "phase_start"
    PHASE_END = "phase_end"
    DEATH = "death"
    DAMAGE_DEALT = "damage_dealt"
    DAMAGE_TAKEN = "damage_taken"
    CARD_DRAWN = "card_drawn"
    SPELL_CAST = "spell_cast"


@dataclass
class TriggerEvent:
    trigger_type: TriggerType
    source: Optional["CardInstance"] = None
    target: Optional["CardInstance"] = None
    player_id: Optional[str] = None
    battlefield_id: Optional[str] = None
    phase: Optional[str] = None
    data: dict = None
    
    def __post_init__(self):
        if self.data is None:
            self.data = {}


class Trigger(ABC):
    
    def __init__(self, effect: "Effect", trigger_type: TriggerType):
        self.effect = effect
        self.trigger_type = trigger_type
        self.once_per_turn = False
        self.has_triggered_this_turn = False
    
    @abstractmethod
    def should_trigger(self, event: TriggerEvent, state: "GameState") -> bool:
        pass
    
    def reset_turn_tracking(self):
        self.has_triggered_this_turn = False
    
    def __repr__(self):
        return f"{self.__class__.__name__}(type={self.trigger_type.value})"
