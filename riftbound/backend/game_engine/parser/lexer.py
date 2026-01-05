from typing import List, Optional
from dataclasses import dataclass
from enum import Enum


class TokenType(str, Enum):
    KEYWORD = "keyword"
    TRIGGER = "trigger"
    EFFECT = "effect"
    NUMBER = "number"
    TARGET = "target"
    CONDITION = "condition"
    SEPARATOR = "separator"
    TEXT = "text"


@dataclass
class Token:
    type: TokenType
    value: str
    position: int
    raw: str


class Lexer:
    
    KEYWORDS = [
        "Action",
        "Reaction",
        "Accelerate",
        "Assault",
        "Ganking",
        "Deflect",
        "Legion",
        "Deathknell",
        "Temporary",
    ]
    
    TRIGGERS = [
        "When you play me",
        "When you discard me",
        "When I conquer",
        "When I hold",
        "When I attack",
        "When I defend",
        "At the start of",
        "At the end of",
    ]
    
    EFFECTS = [
        "Deal",
        "Draw",
        "Discard",
        "Kill",
        "Move",
        "Recall",
        "Channel",
        "Ready",
        "Exhaust",
        "Give",
        "Create",
        "Play",
        "Counter",
        "Stun",
        "Heal",
    ]
    
    TARGETS = [
        "a unit at a battlefield",
        "a unit",
        "all units",
        "a battlefield",
        "a player",
        "me",
    ]
    
    CONDITIONALS = [
        "If this kills it",
        "If you've discarded",
        "If an opponent controls",
        "If you control",
    ]
    
    def __init__(self, text: str):
        self.text = text
        self.position = 0
        self.tokens: List[Token] = []
    
    def tokenize(self) -> List[Token]:
        sentences = self._split_sentences(self.text)
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            self._tokenize_sentence(sentence)
        
        return self.tokens
    
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
    
    def _tokenize_sentence(self, sentence: str):
        remaining = sentence
        pos = 0
        
        while remaining:
            remaining = remaining.lstrip()
            if not remaining:
                break
            
            matched = False
            
            for keyword in self.KEYWORDS:
                if remaining.lower().startswith(keyword.lower()):
                    self.tokens.append(Token(
                        type=TokenType.KEYWORD,
                        value=keyword,
                        position=pos,
                        raw=remaining[:len(keyword)]
                    ))
                    remaining = remaining[len(keyword):]
                    pos += len(keyword)
                    matched = True
                    break
            
            if matched:
                continue
            
            for trigger in self.TRIGGERS:
                if remaining.lower().startswith(trigger.lower()):
                    self.tokens.append(Token(
                        type=TokenType.TRIGGER,
                        value=trigger,
                        position=pos,
                        raw=remaining[:len(trigger)]
                    ))
                    remaining = remaining[len(trigger):]
                    pos += len(trigger)
                    matched = True
                    break
            
            if matched:
                continue
            
            for cond in self.CONDITIONALS:
                if remaining.lower().startswith(cond.lower()):
                    self.tokens.append(Token(
                        type=TokenType.CONDITION,
                        value=cond,
                        position=pos,
                        raw=remaining[:len(cond)]
                    ))
                    remaining = remaining[len(cond):]
                    pos += len(cond)
                    matched = True
                    break
            
            if matched:
                continue
            
            for effect in self.EFFECTS:
                if remaining.lower().startswith(effect.lower()):
                    self.tokens.append(Token(
                        type=TokenType.EFFECT,
                        value=effect,
                        position=pos,
                        raw=remaining[:len(effect)]
                    ))
                    remaining = remaining[len(effect):]
                    pos += len(effect)
                    matched = True
                    break
            
            if matched:
                continue
            
            if remaining[0] in '.,;:':
                self.tokens.append(Token(
                    type=TokenType.SEPARATOR,
                    value=remaining[0],
                    position=pos,
                    raw=remaining[0]
                ))
                remaining = remaining[1:]
                pos += 1
                continue
            
            if remaining[0].isdigit():
                num = ""
                i = 0
                while i < len(remaining) and remaining[i].isdigit():
                    num += remaining[i]
                    i += 1
                self.tokens.append(Token(
                    type=TokenType.NUMBER,
                    value=num,
                    position=pos,
                    raw=num
                ))
                remaining = remaining[i:]
                pos += i
                continue
            
            word = ""
            i = 0
            while i < len(remaining) and remaining[i] not in '.,;: \t\n':
                word += remaining[i]
                i += 1
            
            if word:
                self.tokens.append(Token(
                    type=TokenType.TEXT,
                    value=word,
                    position=pos,
                    raw=word
                ))
                remaining = remaining[i:]
                pos += i
            else:
                remaining = remaining[1:]
                pos += 1
    
    def __repr__(self):
        return f"Lexer(tokens={len(self.tokens)})"
