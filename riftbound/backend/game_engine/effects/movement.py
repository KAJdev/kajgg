from typing import TYPE_CHECKING, Optional
from .base import Effect, EffectContext
from .targeting import Target

if TYPE_CHECKING:
    from ..state import CardInstance, Battlefield


class MoveEffect(Effect):
    
    def __init__(
        self,
        source_location: str = "battlefield",
        destination: str = "base",
        target: Target = Target.UNIT
    ):
        super().__init__()
        self.source_location = source_location
        self.destination = destination
        self.target = target
    
    def requires_target(self) -> bool:
        return True
    
    def can_execute(self, context: EffectContext) -> bool:
        return context.target_id is not None
    
    def execute(self, context: EffectContext) -> dict:
        if not context.target_id:
            return {"success": False, "error": "no target specified"}
        
        target_unit = None
        source_location = None
        
        for bf in context.state.battlefields:
            for unit in bf.player1_units + bf.player2_units:
                if unit.instance_id == context.target_id:
                    target_unit = unit
                    source_location = bf
                    break
            if target_unit:
                break
        
        if not target_unit:
            for player in [context.state.player1, context.state.player2]:
                for unit in player.base_units:
                    if unit.instance_id == context.target_id:
                        target_unit = unit
                        source_location = "base"
                        break
                if target_unit:
                    break
        
        if not target_unit:
            if self.can_partial_resolve:
                return {"success": True, "skipped": True}
            return {"success": False, "error": "target not found"}
        
        if isinstance(source_location, type(context.state.battlefields[0])):
            source_location.remove_unit(target_unit.instance_id)
        elif source_location == "base":
            owner = context.state.get_player(target_unit.owner_id)
            if owner and target_unit in owner.base_units:
                owner.base_units.remove(target_unit)
        
        if self.destination == "base":
            owner = context.state.get_player(target_unit.owner_id)
            if owner:
                owner.base_units.append(target_unit)
        elif self.destination == "battlefield":
            dest_bf_id = context.additional_data.get("destination_battlefield")
            if dest_bf_id:
                dest_bf = next((bf for bf in context.state.battlefields if bf.instance_id == dest_bf_id), None)
                if dest_bf:
                    owner = context.state.get_player(target_unit.owner_id)
                    if owner:
                        if owner.id == context.state.player1.id:
                            dest_bf.player1_units.append(target_unit)
                        else:
                            dest_bf.player2_units.append(target_unit)
        
        return {
            "success": True,
            "target": target_unit.title,
            "destination": self.destination
        }
    
    def __repr__(self):
        return f"MoveEffect(from={self.source_location}, to={self.destination})"


class RecallEffect(Effect):
    
    def __init__(self, target: Target = Target.UNIT, destination: str = "hand"):
        super().__init__()
        self.target = target
        self.destination = destination
    
    def requires_target(self) -> bool:
        return True
    
    def can_execute(self, context: EffectContext) -> bool:
        return context.target_id is not None
    
    def execute(self, context: EffectContext) -> dict:
        if not context.target_id:
            return {"success": False, "error": "no target specified"}
        
        target_card = None
        
        for bf in context.state.battlefields:
            for unit in bf.player1_units + bf.player2_units:
                if unit.instance_id == context.target_id:
                    target_card = unit
                    bf.remove_unit(unit.instance_id)
                    break
            if target_card:
                break
        
        if not target_card:
            for player in [context.state.player1, context.state.player2]:
                for unit in player.base_units:
                    if unit.instance_id == context.target_id:
                        target_card = unit
                        player.base_units.remove(unit)
                        break
                if target_card:
                    break
        
        if not target_card:
            if self.can_partial_resolve:
                return {"success": True, "skipped": True}
            return {"success": False, "error": "target not found"}
        
        owner = context.state.get_player(target_card.owner_id)
        if not owner:
            return {"success": False, "error": "owner not found"}
        
        if self.destination == "hand":
            owner.hand.append(target_card)
        elif self.destination == "deck":
            owner.main_deck.append(target_card)
        elif self.destination == "trash":
            owner.graveyard.append(target_card)
        
        return {
            "success": True,
            "target": target_card.title,
            "destination": self.destination
        }
    
    def __repr__(self):
        return f"RecallEffect(destination={self.destination})"
