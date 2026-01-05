# Riftbound Card Text Parser

A comprehensive card text parsing system that transforms plaintext card descriptions into discrete game actions.

## Architecture Overview

The parser system is organized into domain-driven modules:

```
game_engine/
├── parser/          # Card text parsing and tokenization
├── effects/         # Discrete effect implementations
├── triggers/        # Event-based trigger system
├── combat/          # Combat and showdown management
├── chain/           # Spell resolution stack
└── scoring/         # Battlefield control and scoring
```

## Quick Start

### Parsing a Card

```python
from riftbound.backend.game_engine.parser import CardTextParser

parser = CardTextParser()
parsed = parser.parse("Deal 3 to a unit at a battlefield. If this kills it, draw 1.")

# ParsedCard with:
# - effects: [DamageEffect(amount=3), ConditionalEffect(...)]
# - keywords: []
# - triggers: []
```

### Executing Effects

```python
from riftbound.backend.game_engine.effects import DamageEffect, EffectContext

effect = DamageEffect(amount=3, target=Target.UNIT_AT_BATTLEFIELD)

context = EffectContext(
    state=game_state,
    source_card=card_instance,
    controller=player,
    target_id="target_unit_id"
)

result = effect.execute(context)
# {'success': True, 'amount': 3, 'target': 'Unit Name', 'destroyed': False}
```

## Supported Card Patterns

### Keywords

- **Action** - Can play during showdowns
- **Reaction** - Can play anytime, even during closed state
- **Accelerate** - Pay additional cost to enter ready
- **Assault X** - +X S while attacking
- **Ganking** - Can move between battlefields
- **Deflect** - Opponents pay extra to target
- **Legion** - Bonus if played another card this turn
- **Deathknell** - Triggers when unit dies
- **Temporary** - Token disappears at end of turn

Example:
```
"Assault 2 +2 S while I'm an attacker."
→ KeywordInstance(keyword=Assault, value=2)
```

### Triggers

#### Play Triggers
```
"When you play me, discard 2."
→ PlayTrigger(effect=DiscardEffect(amount=2))
```

#### Combat Triggers
```
"When I conquer, draw 1."
→ ConquerTrigger(effect=DrawEffect(amount=1))
```

#### Phase Triggers
```
"At the start of your turn, deal 1 to each unit."
→ PhaseStartTrigger(phase="turn", effect=DamageEffect(...))
```

#### Discard Triggers
```
"When you discard me, you may pay C to play me."
→ DiscardTrigger(effect=PlayEffect(), pay_cost=1)
```

### Effects

#### Damage Effects
```
"Deal 3 to a unit at a battlefield."
→ DamageEffect(amount=3, target=Target.UNIT_AT_BATTLEFIELD)

"Deal 5 to all units."
→ DamageEffect(amount=5, target=Target.ALL_UNITS)
```

#### Draw/Discard Effects
```
"Draw 2."
→ DrawEffect(amount=2)

"Discard 1."
→ DiscardEffect(amount=1)
```

#### Buff Effects
```
"Give a unit +3 S this turn."
→ BuffEffect(might_bonus=3, target=Target.UNIT, duration="this_turn")

"Give a unit Assault 3 this turn."
→ BuffEffect(attack_bonus=3, keyword="Assault", duration="this_turn")
```

#### Movement Effects
```
"Move a unit from a battlefield to its base."
→ MoveEffect(source_location="battlefield", destination="base")

"Recall a unit to its owner's hand."
→ RecallEffect(destination="hand")
```

#### Destruction Effects
```
"Kill a unit."
→ KillEffect(target=Target.UNIT)

"Kill all enemy units."
→ KillEffect(target=Target.ALL_ENEMY_UNITS)
```

#### Resource Effects
```
"Channel 2 runes."
→ ChannelEffect(amount=2)

"Ready a unit."
→ ReadyEffect()

"Exhaust a unit."
→ ExhaustEffect()
```

### Conditionals

```
"If this kills it, draw 1."
→ ConditionalEffect(
    condition=Condition.IF_THIS_KILLS,
    effect=DrawEffect(amount=1)
)

"Legion: Draw 1."
→ ConditionalEffect(
    condition=Condition.LEGION,
    effect=DrawEffect(amount=1)
)
```

### Activated Abilities

```
"T: Deal 2 to a unit at a battlefield."
→ ActivatedAbility(
    cost="T",
    effect=DamageEffect(amount=2, target=Target.UNIT_AT_BATTLEFIELD)
)
```

## Integration with Game Engine

### Automatic Parsing on Card Load

Cards are automatically parsed when loaded into the game:

```python
# In GameEngine.__init__
self.parser = CardTextParser()

# In GameEngine.draw_initial_hands
for card in player.hand:
    self.parse_card(card)

# Parsed data stored on card.parsed_card
```

### Trigger Registration

When units are played, their triggers are registered:

```python
# In GameEngine._cmd_play_card
if card.is_unit:
    self.register_triggers(card)
    
    event = TriggerEvent(
        trigger_type=TriggerType.PLAY,
        source=card,
        player_id=player.id
    )
    self.fire_triggers(event)
```

### Spell Resolution

Spells use the parsed effects instead of regex:

```python
if card.is_spell:
    if card.parsed_card and card.parsed_card.effects:
        context = EffectContext(
            state=self.state,
            source_card=card,
            controller=player,
            target_id=target_id
        )
        
        for effect in card.parsed_card.effects:
            result = effect.execute(context)
```

## Effect System

### Base Effect Class

All effects inherit from `Effect`:

```python
class Effect(ABC):
    def execute(self, context: EffectContext) -> dict[str, Any]:
        pass
    
    def can_execute(self, context: EffectContext) -> bool:
        pass
    
    def requires_target(self) -> bool:
        pass
    
    def get_valid_targets(self, context: EffectContext) -> list[str]:
        pass
```

### Effect Context

Effects receive a context with game state:

```python
@dataclass
class EffectContext:
    state: GameState
    source_card: Optional[CardInstance] = None
    controller: Optional[Player] = None
    target_id: Optional[str] = None
    additional_data: dict = None
```

### Partial Resolution

Effects support "do as much as you can" rule:

```python
effect = DamageEffect(amount=3)
effect.can_partial_resolve = True  # Default

# If target invalid, returns {'success': True, 'skipped': True}
```

## Trigger System

### Trigger Types

```python
class TriggerType(str, Enum):
    PLAY = "play"
    DISCARD = "discard"
    CONQUER = "conquer"
    HOLD = "hold"
    ATTACK = "attack"
    DEFEND = "defend"
    PHASE_START = "phase_start"
    PHASE_END = "phase_end"
    DEATH = "death"
    DAMAGE_DEALT = "damage_dealt"
    DAMAGE_TAKEN = "damage_taken"
```

### Firing Triggers

```python
event = TriggerEvent(
    trigger_type=TriggerType.CONQUER,
    source=conquering_unit,
    battlefield_id=battlefield.id
)

engine.fire_triggers(event)
```

### Conditional Triggers

Triggers can have conditions:

```python
class Condition(str, Enum):
    IF_THIS_KILLS = "if_this_kills"
    IF_DISCARDED_THIS_TURN = "if_discarded_this_turn"
    LEGION = "legion"
    IF_OPPONENT_CONTROLS_BATTLEFIELD = "if_opponent_controls_battlefield"
```

## Chain/Stack System

### Adding to Chain

```python
engine.chain_manager.add_to_chain(
    card=spell_card,
    controller=player,
    effect=parsed_effect,
    target_id=target_id
)
```

### Resolving Chain

```python
# Chain resolves in LIFO order (last in, first out)
engine.chain_manager.resolve_chain()
```

### Priority System

```python
engine.priority_manager.give_priority_to(player)

if engine.priority_manager.has_priority(player):
    # Player can add to chain
    pass

engine.priority_manager.pass_priority(player)
```

## Combat System

### Combat Manager

```python
engine.combat_manager.resolve_combat(battlefield)
# - Calculates total might for each side
# - Applies damage to all units
# - Destroys units with damage >= might
# - Updates battlefield control
```

### Damage Calculator

```python
DamageCalculator.calculate_combat_damage(attacker, defender)
# Returns: (attacker_damage, defender_damage)

DamageCalculator.calculate_might(unit, context="attacking")
# Includes buffs and Assault bonuses
```

### Showdown Manager

```python
engine.showdown_manager.initiate_showdown(battlefield)
# Handles showdowns without combat
```

## Targeting System

### Target Types

```python
class Target(str, Enum):
    UNIT = "unit"
    UNIT_AT_BATTLEFIELD = "unit_at_battlefield"
    UNIT_AT_BASE = "unit_at_base"
    ANY_UNIT = "any_unit"
    ALL_UNITS = "all_units"
    ALL_FRIENDLY_UNITS = "all_friendly_units"
    ALL_ENEMY_UNITS = "all_enemy_units"
    PLAYER = "player"
    BATTLEFIELD = "battlefield"
```

### Target Selection

```python
from riftbound.backend.game_engine.effects import TargetSelector, Target

targets = TargetSelector.get_valid_targets(
    state=game_state,
    target_type=Target.UNIT_AT_BATTLEFIELD,
    controller=player,
    battlefield_id=battlefield.id
)
```

### Target Filtering

```python
from riftbound.backend.game_engine.effects import TargetFilter

filter = TargetFilter(
    card_type="unit",
    tags=["Dragon"],
    min_might=3,
    controller_id=player.id
)

targets = TargetSelector.get_valid_targets(
    state=game_state,
    target_type=Target.ANY_UNIT,
    filter=filter
)
```

## Event Emission

All systems emit events for frontend sync:

```python
# Effect resolved
self._emit("effect_resolved", {
    "card": card.title,
    "effect": str(effect),
    "result": result
})

# Trigger fired
self._emit("trigger_fired", {
    "card": card.title,
    "trigger": str(trigger),
    "result": result
})

# Combat events
self._emit("combat_started", {...})
self._emit("unit_destroyed", {...})
self._emit("combat_ended", {...})

# Chain events
self._emit("chain_link_added", {...})
self._emit("chain_link_resolving", {...})
self._emit("chain_resolved", {...})
```

## Example: Complete Card Parse

```python
card_text = """
Accelerate You may pay 1C as an additional cost to have me enter ready.
Assault 2 +2 S while I'm an attacker.
When you play me, discard 2.
"""

parsed = parser.parse(card_text)

# Result:
ParsedCard(
    keywords=[
        KeywordInstance(keyword=Keyword.ACCELERATE, value=1),
        KeywordInstance(keyword=Keyword.ASSAULT, value=2)
    ],
    effects=[],
    triggers=[
        PlayTrigger(effect=DiscardEffect(amount=2))
    ],
    activated_abilities=[],
    entry_state=None
)
```

## Extending the Parser

### Adding New Effects

1. Create effect class in `effects/`:
```python
class HealEffect(Effect):
    def __init__(self, amount: int):
        super().__init__()
        self.amount = amount
    
    def execute(self, context: EffectContext) -> dict:
        # Implementation
        pass
```

2. Add pattern to `parser/patterns.py`:
```python
HEAL_PATTERN = re.compile(
    r"Heal\s+(\d+)",
    re.IGNORECASE
)
```

3. Add parser logic in `parser/parser.py`:
```python
match = patterns.HEAL_PATTERN.search(effect_text)
if match:
    amount = int(match.group(1))
    return HealEffect(amount=amount)
```

### Adding New Triggers

1. Create trigger class in `triggers/`:
```python
class DrawTrigger(Trigger):
    def should_trigger(self, event: TriggerEvent, state: GameState) -> bool:
        return event.trigger_type == TriggerType.CARD_DRAWN
```

2. Add trigger pattern and parsing logic

3. Register trigger type in `TriggerType` enum

## Testing

Run the parser test:

```bash
python test_parser.py
```

Example output:
```
Card: Disintegrate
Text: Action Play on your turn or in showdowns. Deal 3 to a unit at a battlefield. If this kills it, draw 1.
------------------------------------------------------------
Parsed: ParsedCard(keywords=1, effects=2, triggers=0)
Keywords: Action
Effects: DamageEffect(amount=3, target=unit_at_battlefield), ConditionalEffect(condition=if_this_kills, effect=DrawEffect(amount=1))
✓ Parsed successfully
```

## Performance Considerations

- Cards are parsed once on load and cached in `card.parsed_card`
- Effects execute directly without regex matching
- Triggers are registered once per unit
- Chain resolution is optimized for LIFO order

## Future Enhancements

- [ ] Support for "until end of turn" modifiers with cleanup
- [ ] Token creation effects
- [ ] Counter spell effects
- [ ] Stun effects
- [ ] More complex targeting (e.g., "target opponent")
- [ ] Cost modification effects
- [ ] Replacement effects ("instead" patterns)
- [ ] Multiple target selection
- [ ] Optional effect execution
