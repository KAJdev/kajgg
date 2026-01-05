from enum import Enum
from typing import Optional
from dataclasses import dataclass


class Keyword(str, Enum):
    ACTION = "Action"
    REACTION = "Reaction"
    ACCELERATE = "Accelerate"
    ASSAULT = "Assault"
    GANKING = "Ganking"
    DEFLECT = "Deflect"
    LEGION = "Legion"
    DEATHKNELL = "Deathknell"
    TEMPORARY = "Temporary"


@dataclass
class KeywordInstance:
    keyword: Keyword
    value: Optional[int] = None
    
    def __repr__(self):
        if self.value is not None:
            return f"{self.keyword.value}({self.value})"
        return self.keyword.value


class KeywordHandler:
    
    @staticmethod
    def parse_keyword(keyword_text: str, value: Optional[int] = None) -> Optional[KeywordInstance]:
        keyword_text_lower = keyword_text.lower()
        
        for keyword in Keyword:
            if keyword.value.lower() == keyword_text_lower:
                return KeywordInstance(keyword=keyword, value=value)
        
        return None
    
    @staticmethod
    def apply_keyword_effect(keyword: KeywordInstance, card_instance):
        if keyword.keyword == Keyword.ACCELERATE:
            return
        
        elif keyword.keyword == Keyword.ASSAULT:
            modifier = {
                "type": "assault",
                "attack_bonus": keyword.value or 0,
                "condition": "while_attacking"
            }
            card_instance.modifiers.append(modifier)
        
        elif keyword.keyword == Keyword.GANKING:
            if not hasattr(card_instance, "abilities"):
                card_instance.abilities = []
            card_instance.abilities.append("ganking")
        
        elif keyword.keyword == Keyword.DEFLECT:
            if not hasattr(card_instance, "abilities"):
                card_instance.abilities = []
            card_instance.abilities.append("deflect")
        
        elif keyword.keyword == Keyword.TEMPORARY:
            if not hasattr(card_instance, "abilities"):
                card_instance.abilities = []
            card_instance.abilities.append("temporary")
