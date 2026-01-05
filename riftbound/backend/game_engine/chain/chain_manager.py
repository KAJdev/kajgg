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
            
            if link.effect:
                from ..effects.base import EffectContext
                context = EffectContext(
                    state=self.state,
                    source_card=link.card,
                    controller=link.controller,
                    target_id=link.target_id
                )
                
                try:
                    result = link.effect.execute(context)
                    
                    self._emit("effect_resolved", {
                        "card": link.card.title,
                        "effect": str(link.effect),
                        "result": result
                    })
                except Exception as e:
                    self._emit("effect_error", {
                        "card": link.card.title,
                        "effect": str(link.effect),
                        "error": str(e)
                    })
            
            link.resolved = True
            
            if link.card.card_type == "spell":
                link.controller.graveyard.append(link.card)
        
        self.resolving = False
        
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
