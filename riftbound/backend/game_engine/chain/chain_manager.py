from typing import TYPE_CHECKING, List, Optional, Callable
from dataclasses import dataclass
from datetime import datetime, timezone

if TYPE_CHECKING:
    from ..state import GameState, CardInstance, Player
    from ..effects.base import Effect


@dataclass
class ChainLink:
    card: "CardInstance"
    controller: "Player"
    effect: Optional["Effect"] = None
    target_id: Optional[str] = None
    timestamp: datetime = None
    resolved: bool = False
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc)
    
    def __repr__(self):
        return f"ChainLink(card={self.card.title}, resolved={self.resolved})"


class ChainManager:
    
    def __init__(self, state: "GameState"):
        self.state = state
        self.chain: List[ChainLink] = []
        self.resolving = False
        self._emit_callback: Optional[Callable] = None
    
    def set_emit_callback(self, callback: Callable):
        self._emit_callback = callback
    
    def _emit(self, event_type: str, data: dict):
        if self._emit_callback:
            self._emit_callback(event_type, data)
    
    def add_to_chain(
        self,
        card: "CardInstance",
        controller: "Player",
        effect: Optional["Effect"] = None,
        target_id: Optional[str] = None
    ) -> ChainLink:
        link = ChainLink(
            card=card,
            controller=controller,
            effect=effect,
            target_id=target_id
        )
        self.chain.append(link)
        self.state.chain_items = [
            {
                "cardTitle": l.card.title,
                "controllerId": l.controller.id,
                "targetId": l.target_id,
            }
            for l in self.chain
        ]
        
        self._emit("chain_link_added", {
            "card": card.title,
            "controller": controller.id,
            "chain_size": len(self.chain)
        })
        
        return link
    
    def resolve_chain(self):
        if self.resolving:
            return
        
        if not self.chain:
            return
        
        self.resolving = True
        
        while self.chain:
            link = self.chain.pop()
            
            if link.resolved:
                continue
            
            self._emit("chain_link_resolving", {
                "card": link.card.title,
                "controller": link.controller.id
            })
            
            from ..effects.base import EffectContext
            context = EffectContext(
                state=self.state,
                source_card=link.card,
                controller=link.controller,
                target_id=link.target_id,
            )
            
            if link.effect:
                try:
                    result = link.effect.execute(context)
                    
                    self._emit("effect_resolved", {
                        "card": link.card.title,
                        "effect": str(link.effect),
                        "result": result,
                    })
                except Exception as e:
                    self._emit("effect_error", {
                        "card": link.card.title,
                        "effect": str(link.effect),
                        "error": str(e),
                    })
            elif getattr(link.card, "parsed_card", None) and getattr(link.card.parsed_card, "effects", None):
                from ..triggers.condition import ConditionalEffect
                from ..state import ActionType
                
                for effect_or_conditional in link.card.parsed_card.effects:
                    if isinstance(effect_or_conditional, ConditionalEffect) or hasattr(effect_or_conditional, "condition"):
                        conditional: ConditionalEffect = effect_or_conditional
                        try:
                            if conditional.check_condition(self.state, controller_id=link.controller.id):
                                result = conditional.effect.execute(context)
                                self._emit("effect_resolved", {
                                    "card": link.card.title,
                                    "effect": str(conditional.effect),
                                    "result": result,
                                })
                            elif conditional.else_effect:
                                result = conditional.else_effect.execute(context)
                                self._emit("effect_resolved", {
                                    "card": link.card.title,
                                    "effect": str(conditional.else_effect),
                                    "result": result,
                                })
                            else:
                                continue
                        except Exception as e:
                            self._emit("effect_error", {
                                "card": link.card.title,
                                "effect": "conditional",
                                "error": str(e),
                            })
                            continue
                    else:
                        effect = effect_or_conditional
                        try:
                            result = effect.execute(context)
                            self._emit("effect_resolved", {
                                "card": link.card.title,
                                "effect": str(effect),
                                "result": result,
                            })
                            self.state.add_action(
                                ActionType.ACTIVATE_ABILITY,
                                link.controller.id,
                                {"type": "spell_effect", "card": link.card.title, "result": result},
                            )
                        except Exception as e:
                            self._emit("effect_error", {
                                "card": link.card.title,
                                "effect": str(effect),
                                "error": str(e),
                            })
            
            link.resolved = True
            
            if link.card.card_type == "spell":
                link.controller.graveyard.append(link.card)
            
            self.state.chain_items = [
                {
                    "cardTitle": l.card.title,
                    "controllerId": l.controller.id,
                    "targetId": l.target_id,
                }
                for l in self.chain
            ]
        
        self.resolving = False
        self.state.chain_items = []
        
        self._emit("chain_resolved", {"chain_size": 0})
    
    def is_open(self) -> bool:
        return len(self.chain) > 0 and not self.resolving
    
    def is_closed(self) -> bool:
        return len(self.chain) == 0 and not self.resolving
    
    def clear(self):
        self.chain.clear()
        self.resolving = False
    
    def __repr__(self):
        return f"ChainManager(chain_size={len(self.chain)}, resolving={self.resolving})"
