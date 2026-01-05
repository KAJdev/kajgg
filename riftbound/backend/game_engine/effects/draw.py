from typing import TYPE_CHECKING, Optional
from .base import Effect, EffectContext

if TYPE_CHECKING:
    from ..state import Player


class DrawEffect(Effect):
    
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
        
        drawn = 0
        for _ in range(self.amount):
            card = context.controller.draw_card()
            if card:
                drawn += 1
        
        return {
            "success": True,
            "amount": drawn,
            "requested": self.amount
        }
    
    def __repr__(self):
        return f"DrawEffect(amount={self.amount})"


class DiscardEffect(Effect):
    
    def __init__(self, amount: int = 1, specific_card_id: Optional[str] = None, random: bool = False):
        super().__init__()
        self.amount = amount
        self.specific_card_id = specific_card_id
        self.random = random
    
    def requires_target(self) -> bool:
        return self.specific_card_id is None and not self.random
    
    def can_execute(self, context: EffectContext) -> bool:
        if not context.controller:
            return False
        if self.specific_card_id:
            return any(c.instance_id == self.specific_card_id for c in context.controller.hand)
        return len(context.controller.hand) > 0
    
    def execute(self, context: EffectContext) -> dict:
        if not context.controller:
            return {"success": False, "error": "no controller specified"}
        
        if self.specific_card_id:
            card = next((c for c in context.controller.hand if c.instance_id == self.specific_card_id), None)
            if card:
                context.controller.hand.remove(card)
                context.controller.graveyard.append(card)
                return {"success": True, "discarded": 1, "card": card.title}
            return {"success": False, "error": "card not found in hand"}
        
        discarded = 0
        discarded_cards = []
        
        for _ in range(self.amount):
            if not context.controller.hand:
                break
            
            if self.random:
                import random
                card = random.choice(context.controller.hand)
            else:
                if context.target_id:
                    card = next((c for c in context.controller.hand if c.instance_id == context.target_id), None)
                    if not card:
                        break
                else:
                    break
            
            context.controller.hand.remove(card)
            context.controller.graveyard.append(card)
            discarded += 1
            discarded_cards.append(card.title)
        
        return {
            "success": True,
            "discarded": discarded,
            "requested": self.amount,
            "cards": discarded_cards
        }
    
    def __repr__(self):
        return f"DiscardEffect(amount={self.amount}, random={self.random})"
