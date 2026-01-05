from typing import TYPE_CHECKING, Optional
from enum import Enum
from dataclasses import dataclass

if TYPE_CHECKING:
    from ..state import GameState, CardInstance, Player


class Target(str, Enum):
    UNIT = "unit"
    UNIT_AT_BATTLEFIELD = "unit_at_battlefield"
    UNIT_AT_BASE = "unit_at_base"
    ANY_UNIT = "any_unit"
    PLAYER = "player"
    BATTLEFIELD = "battlefield"
    CARD_IN_HAND = "card_in_hand"
    CARD_IN_TRASH = "card_in_trash"
    GEAR = "gear"
    SELF = "self"
    ALL_UNITS = "all_units"
    ALL_UNITS_AT_BATTLEFIELD = "all_units_at_battlefield"
    ALL_FRIENDLY_UNITS = "all_friendly_units"
    ALL_ENEMY_UNITS = "all_enemy_units"


@dataclass
class TargetFilter:
    card_type: Optional[str] = None
    tags: Optional[list[str]] = None
    min_might: Optional[int] = None
    max_might: Optional[int] = None
    controller_id: Optional[str] = None
    location: Optional[str] = None
    exhausted: Optional[bool] = None


class TargetSelector:
    
    @staticmethod
    def get_valid_targets(
        state: "GameState",
        target_type: Target,
        controller: Optional["Player"] = None,
        battlefield_id: Optional[str] = None,
        filter: Optional[TargetFilter] = None
    ) -> list["CardInstance"]:
        targets = []
        
        if target_type == Target.UNIT_AT_BATTLEFIELD:
            for bf in state.battlefields:
                if battlefield_id and bf.instance_id != battlefield_id:
                    continue
                targets.extend(bf.player1_units)
                targets.extend(bf.player2_units)
        
        elif target_type == Target.UNIT_AT_BASE:
            if controller:
                targets.extend(controller.base_units)
            else:
                targets.extend(state.player1.base_units)
                targets.extend(state.player2.base_units)
        
        elif target_type == Target.ANY_UNIT:
            targets.extend(state.player1.base_units)
            targets.extend(state.player2.base_units)
            for bf in state.battlefields:
                targets.extend(bf.player1_units)
                targets.extend(bf.player2_units)
        
        elif target_type == Target.ALL_UNITS_AT_BATTLEFIELD:
            for bf in state.battlefields:
                if battlefield_id and bf.instance_id != battlefield_id:
                    continue
                targets.extend(bf.player1_units)
                targets.extend(bf.player2_units)
        
        elif target_type == Target.ALL_FRIENDLY_UNITS:
            if controller:
                targets.extend(controller.base_units)
                for bf in state.battlefields:
                    units = bf.player1_units if controller.id == state.player1.id else bf.player2_units
                    targets.extend(units)
        
        elif target_type == Target.ALL_ENEMY_UNITS:
            if controller:
                opponent_id = state.player2.id if controller.id == state.player1.id else state.player1.id
                opponent = state.get_player(opponent_id)
                if opponent:
                    targets.extend(opponent.base_units)
                    for bf in state.battlefields:
                        units = bf.player2_units if controller.id == state.player1.id else bf.player1_units
                        targets.extend(units)
        
        elif target_type == Target.CARD_IN_HAND:
            if controller:
                targets.extend(controller.hand)
        
        elif target_type == Target.CARD_IN_TRASH:
            if controller:
                targets.extend(controller.graveyard)
        
        elif target_type == Target.GEAR:
            if controller:
                targets.extend(controller.base_gear)
            else:
                targets.extend(state.player1.base_gear)
                targets.extend(state.player2.base_gear)
        
        if filter:
            targets = TargetSelector._apply_filter(targets, filter)
        
        return targets
    
    @staticmethod
    def _apply_filter(targets: list["CardInstance"], filter: TargetFilter) -> list["CardInstance"]:
        filtered = targets
        
        if filter.card_type:
            filtered = [t for t in filtered if t.card_type == filter.card_type]
        
        if filter.tags:
            filtered = [t for t in filtered if any(tag in t.tags for tag in filter.tags)]
        
        if filter.min_might is not None:
            filtered = [t for t in filtered if t.might >= filter.min_might]
        
        if filter.max_might is not None:
            filtered = [t for t in filtered if t.might <= filter.max_might]
        
        if filter.controller_id:
            filtered = [t for t in filtered if t.owner_id == filter.controller_id]
        
        if filter.exhausted is not None:
            filtered = [t for t in filtered if t.exhausted == filter.exhausted]
        
        return filtered
