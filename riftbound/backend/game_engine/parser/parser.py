from typing import List, Optional, Union
from dataclasses import dataclass, field
import re

from .keywords import Keyword, KeywordInstance, KeywordHandler
from . import patterns
from ..effects.base import Effect
from ..effects.damage import DamageEffect
from ..effects.draw import DrawEffect, DiscardEffect
from ..effects.buff import BuffEffect
from ..effects.movement import MoveEffect, RecallEffect
from ..effects.destruction import KillEffect
from ..effects.resource import ChannelEffect, ReadyEffect, ExhaustEffect
from ..effects.targeting import Target
from ..triggers.base import Trigger
from ..triggers.play_triggers import PlayTrigger, DiscardTrigger
from ..triggers.combat_triggers import ConquerTrigger, HoldTrigger, AttackTrigger, DefendTrigger
from ..triggers.phase_triggers import PhaseStartTrigger, PhaseEndTrigger
from ..triggers.condition import Condition, ConditionalEffect


@dataclass
class ActivatedAbility:
    cost: str
    effect: Effect
    
    def __repr__(self):
        return f"ActivatedAbility(cost={self.cost}, effect={self.effect})"


@dataclass
class ParsedCard:
    keywords: List[KeywordInstance] = field(default_factory=list)
    effects: List[Union[Effect, ConditionalEffect]] = field(default_factory=list)
    triggers: List[Trigger] = field(default_factory=list)
    activated_abilities: List[ActivatedAbility] = field(default_factory=list)
    entry_state: Optional[str] = None
    cost_modifiers: List[dict] = field(default_factory=list)
    raw_text: str = ""
    
    def __repr__(self):
        return f"ParsedCard(keywords={len(self.keywords)}, effects={len(self.effects)}, triggers={len(self.triggers)})"


class CardTextParser:
    
    def __init__(self):
        self.debug = False
    
    def parse(self, card_text: str) -> ParsedCard:
        if not card_text or card_text.strip() == "":
            return ParsedCard(raw_text=card_text)
        
        parsed = ParsedCard(raw_text=card_text)
        
        text = card_text.strip()
        
        sentences = self._split_sentences(text)
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            self._parse_sentence(sentence, parsed)
        
        return parsed
    
    def _split_sentences(self, text: str) -> List[str]:
        sentences = []
        current = ""
        
        i = 0
        while i < len(text):
            char = text[i]
            current += char
            
            if char == '.':
                if i + 1 < len(text) and text[i + 1] == ' ':
                    sentences.append(current.strip())
                    current = ""
                elif i + 1 == len(text):
                    sentences.append(current.strip())
                    current = ""
            
            i += 1
        
        if current.strip():
            sentences.append(current.strip())
        
        return sentences
    
    def _parse_sentence(self, sentence: str, parsed: ParsedCard):
        
        if patterns.ACTION_KEYWORD_PATTERN.search(sentence):
            keyword = KeywordHandler.parse_keyword("Action")
            if keyword:
                parsed.keywords.append(keyword)
            sentence = patterns.ACTION_KEYWORD_PATTERN.sub("", sentence).strip()
        
        if patterns.REACTION_KEYWORD_PATTERN.search(sentence):
            keyword = KeywordHandler.parse_keyword("Reaction")
            if keyword:
                parsed.keywords.append(keyword)
            sentence = patterns.REACTION_KEYWORD_PATTERN.sub("", sentence).strip()
        
        if patterns.GANKING_KEYWORD_PATTERN.search(sentence):
            keyword = KeywordHandler.parse_keyword("Ganking")
            if keyword:
                parsed.keywords.append(keyword)
        
        if patterns.DEFLECT_KEYWORD_PATTERN.search(sentence):
            keyword = KeywordHandler.parse_keyword("Deflect")
            if keyword:
                parsed.keywords.append(keyword)
        
        if patterns.TEMPORARY_KEYWORD_PATTERN.search(sentence):
            keyword = KeywordHandler.parse_keyword("Temporary")
            if keyword:
                parsed.keywords.append(keyword)
        
        match = patterns.ACCELERATE_PATTERN.search(sentence)
        if match:
            cost = int(match.group(1))
            keyword = KeywordInstance(keyword=Keyword.ACCELERATE, value=cost)
            parsed.keywords.append(keyword)
            return
        
        match = patterns.ASSAULT_PATTERN.search(sentence)
        if match:
            value = int(match.group(1))
            keyword = KeywordInstance(keyword=Keyword.ASSAULT, value=value)
            parsed.keywords.append(keyword)
            sentence = patterns.ASSAULT_PATTERN.sub("", sentence).strip()
        
        match = patterns.WHEN_PLAY_PATTERN.search(sentence)
        if match:
            effect_text = match.group(1)
            effect = self._parse_effect(effect_text)
            if effect:
                trigger = PlayTrigger(effect)
                parsed.triggers.append(trigger)
            return
        
        match = patterns.WHEN_DISCARD_PATTERN.search(sentence)
        if match:
            effect_text = match.group(1)
            
            pay_cost = None
            cost_match = re.search(r"you\s+may\s+pay\s+(\d*)C\s+to\s+(.+)", effect_text, re.IGNORECASE)
            if cost_match:
                pay_cost = int(cost_match.group(1)) if cost_match.group(1) else 1
                effect_text = cost_match.group(2)
            
            effect = self._parse_effect(effect_text)
            if effect:
                trigger = DiscardTrigger(effect, pay_cost=pay_cost)
                parsed.triggers.append(trigger)
            return
        
        match = patterns.WHEN_CONQUER_PATTERN.search(sentence)
        if match:
            effect_text = match.group(1)
            effect = self._parse_effect(effect_text)
            if effect:
                trigger = ConquerTrigger(effect)
                parsed.triggers.append(trigger)
            return
        
        match = patterns.WHEN_HOLD_PATTERN.search(sentence)
        if match:
            effect_text = match.group(1)
            effect = self._parse_effect(effect_text)
            if effect:
                trigger = HoldTrigger(effect)
                parsed.triggers.append(trigger)
            return
        
        match = patterns.AT_START_OF_PATTERN.search(sentence)
        if match:
            phase = match.group(1)
            effect_text = match.group(2)
            effect = self._parse_effect(effect_text)
            if effect:
                trigger = PhaseStartTrigger(effect, phase=phase)
                parsed.triggers.append(trigger)
            return
        
        match = patterns.AT_END_OF_PATTERN.search(sentence)
        if match:
            phase = match.group(1)
            effect_text = match.group(2)
            effect = self._parse_effect(effect_text)
            if effect:
                trigger = PhaseEndTrigger(effect, phase=phase)
                parsed.triggers.append(trigger)
            return
        
        match = patterns.LEGION_PATTERN.search(sentence)
        if match:
            effect_text = match.group(1)
            effect = self._parse_effect(effect_text)
            if effect:
                conditional = ConditionalEffect(Condition.LEGION, effect)
                parsed.effects.append(conditional)
            return
        
        match = patterns.DEATHKNELL_PATTERN.search(sentence)
        if match:
            effect_text = match.group(1)
            effect = self._parse_effect(effect_text)
            if effect:
                from ..triggers.base import TriggerType
                trigger = type('DeathTrigger', (Trigger,), {
                    'should_trigger': lambda self, event, state: event.trigger_type == TriggerType.DEATH
                })(effect, TriggerType.DEATH)
                parsed.triggers.append(trigger)
            return
        
        if re.search(r"T:", sentence):
            parts = sentence.split("T:")
            if len(parts) > 1:
                effect_text = parts[1].strip()
                effect = self._parse_effect(effect_text)
                if effect:
                    ability = ActivatedAbility(cost="T", effect=effect)
                    parsed.activated_abilities.append(ability)
            return
        
        if "this enters exhausted" in sentence.lower():
            parsed.entry_state = "exhausted"
            return
        
        match = patterns.COST_REDUCTION_PATTERN.search(sentence)
        if match:
            reduction = int(match.group(1))
            parsed.cost_modifiers.append({"type": "reduction", "amount": reduction})
            return
        
        match = patterns.IF_THIS_KILLS_PATTERN.search(sentence)
        if match:
            effect_text = match.group(1)
            effect = self._parse_effect(effect_text)
            if effect:
                conditional = ConditionalEffect(Condition.IF_THIS_KILLS, effect)
                
                damage_match = patterns.DEAL_DAMAGE_PATTERN.search(sentence)
                if damage_match:
                    damage_effect = self._parse_damage_effect(damage_match)
                    if damage_effect:
                        parsed.effects.append(damage_effect)
                
                parsed.effects.append(conditional)
            return
        
        effect = self._parse_effect(sentence)
        if effect:
            parsed.effects.append(effect)
    
    def _parse_effect(self, effect_text: str) -> Optional[Effect]:
        effect_text = effect_text.strip()
        
        match = patterns.DEAL_DAMAGE_PATTERN.search(effect_text)
        if match:
            return self._parse_damage_effect(match)
        
        match = patterns.DRAW_PATTERN.search(effect_text)
        if match:
            amount = int(match.group(1))
            return DrawEffect(amount=amount)
        
        match = patterns.DISCARD_PATTERN.search(effect_text)
        if match:
            amount = int(match.group(1))
            return DiscardEffect(amount=amount)
        
        match = patterns.GIVE_BUFF_PATTERN.search(effect_text)
        if match:
            target_text = match.group(1)
            might_bonus = int(match.group(2))
            
            target = Target.UNIT
            if "me" in target_text.lower():
                target = Target.SELF
            elif "a unit" in target_text.lower():
                target = Target.UNIT
            
            duration = "this_turn" if "this turn" in effect_text.lower() else "permanent"
            
            keyword_match = re.search(r"Assault\s+(\d+)", effect_text, re.IGNORECASE)
            if keyword_match:
                return BuffEffect(
                    attack_bonus=might_bonus,
                    target=target,
                    duration=duration,
                    keyword="Assault"
                )
            
            return BuffEffect(might_bonus=might_bonus, target=target, duration=duration)
        
        match = patterns.KILL_PATTERN.search(effect_text)
        if match:
            target_text = match.group(1)
            target = self._parse_target(target_text)
            return KillEffect(target=target)
        
        match = patterns.MOVE_PATTERN.search(effect_text)
        if match:
            target_text = match.group(1)
            destination_text = match.group(2)
            
            destination = "base" if "base" in destination_text.lower() else "battlefield"
            
            return MoveEffect(destination=destination)
        
        match = patterns.RECALL_PATTERN.search(effect_text)
        if match:
            destination_text = match.group(2)
            destination = "hand"
            if "deck" in destination_text.lower():
                destination = "deck"
            elif "trash" in destination_text.lower():
                destination = "trash"
            
            return RecallEffect(destination=destination)
        
        match = patterns.CHANNEL_PATTERN.search(effect_text)
        if match:
            amount = int(match.group(1))
            return ChannelEffect(amount=amount)
        
        match = patterns.READY_PATTERN.search(effect_text)
        if match:
            return ReadyEffect()
        
        if effect_text.lower().startswith("play me"):
            return None
        
        return None
    
    def _parse_damage_effect(self, match) -> Optional[DamageEffect]:
        amount = int(match.group(1))
        target_text = match.group(2)
        
        target = self._parse_target(target_text)
        
        return DamageEffect(amount=amount, target=target)
    
    def _parse_target(self, target_text: str) -> Target:
        target_text_lower = target_text.lower()
        
        if patterns.TARGET_UNIT_AT_BATTLEFIELD.search(target_text):
            return Target.UNIT_AT_BATTLEFIELD
        
        if patterns.TARGET_ALL_UNITS.search(target_text):
            return Target.ALL_UNITS
        
        if "a unit" in target_text_lower:
            return Target.UNIT
        
        if "me" in target_text_lower or "it" in target_text_lower:
            return Target.SELF
        
        if "battlefield" in target_text_lower:
            return Target.BATTLEFIELD
        
        return Target.UNIT
    
    def __repr__(self):
        return "CardTextParser()"
