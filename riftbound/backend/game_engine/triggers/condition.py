from typing import TYPE_CHECKING, Optional
from enum import Enum
from .base import Trigger, TriggerType, TriggerEvent

if TYPE_CHECKING:
    from ..state import GameState
    from ..effects.base import Effect


class Condition(str, Enum):
    IF_THIS_KILLS = "if_this_kills"
    IF_DISCARDED_THIS_TURN = "if_discarded_this_turn"
    LEGION = "legion"
    IF_OPPONENT_CONTROLS_BATTLEFIELD = "if_opponent_controls_battlefield"
    IF_YOU_CONTROL_BATTLEFIELD = "if_you_control_battlefield"
    IF_EXHAUSTED = "if_exhausted"
    IF_READY = "if_ready"


class ConditionalEffect:
    
    def __init__(self, condition: Condition, effect: "Effect", else_effect: Optional["Effect"] = None):
        self.condition = condition
        self.effect = effect
        self.else_effect = else_effect
    
    def check_condition(self, state: "GameState", event: Optional[TriggerEvent] = None, controller_id: Optional[str] = None) -> bool:
        if self.condition == Condition.IF_THIS_KILLS:
            if event and event.data:
                return event.data.get("killed", False)
            return False
        
        elif self.condition == Condition.IF_DISCARDED_THIS_TURN:
            if controller_id:
                player = state.get_player(controller_id)
                if player:
                    return len([a for a in state.actions if a.get("type") == "discard" and a.get("player") == controller_id]) > 0
            return False
        
        elif self.condition == Condition.LEGION:
            if controller_id:
                actions_this_turn = [a for a in state.actions if a.get("player") == controller_id]
                play_actions = [a for a in actions_this_turn if a.get("type") in ["play_card", "play_unit", "play_spell"]]
                return len(play_actions) > 1
            return False
        
        elif self.condition == Condition.IF_OPPONENT_CONTROLS_BATTLEFIELD:
            if controller_id:
                opponent_id = state.player2.id if controller_id == state.player1.id else state.player1.id
                for bf in state.battlefields:
                    if bf.controller == opponent_id:
                        return True
            return False
        
        elif self.condition == Condition.IF_YOU_CONTROL_BATTLEFIELD:
            if controller_id:
                for bf in state.battlefields:
                    if bf.controller == controller_id:
                        return True
            return False
        
        return False
    
    def __repr__(self):
        return f"ConditionalEffect(condition={self.condition.value}, effect={self.effect})"
