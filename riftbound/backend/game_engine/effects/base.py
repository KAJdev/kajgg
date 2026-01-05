from typing import TYPE_CHECKING, Optional, Any
from dataclasses import dataclass
from abc import ABC, abstractmethod

if TYPE_CHECKING:
    from ..state import GameState, CardInstance, Player


@dataclass
class EffectContext:
    state: "GameState"
    source_card: Optional["CardInstance"] = None
    controller: Optional["Player"] = None
    target_id: Optional[str] = None
    additional_data: dict = None
    
    def __post_init__(self):
        if self.additional_data is None:
            self.additional_data = {}


class Effect(ABC):
    
    def __init__(self):
        self.can_partial_resolve = True
    
    @abstractmethod
    def execute(self, context: EffectContext) -> dict[str, Any]:
        pass
    
    @abstractmethod
    def can_execute(self, context: EffectContext) -> bool:
        pass
    
    @abstractmethod
    def requires_target(self) -> bool:
        pass
    
    def get_valid_targets(self, context: EffectContext) -> list[str]:
        return []
    
    def __repr__(self):
        return f"{self.__class__.__name__}()"
