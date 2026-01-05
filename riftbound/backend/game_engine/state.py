"""
riftbound game state definitions.

based on official riftbound core rules:
- deck: 1 champion legend, 3 battlefields, 12 runes, 40 main deck cards
- turn: awaken(ready) → beginning(score) → channel → draw → action(main) → end
- resources: energy (exhaust runes), power (recycle runes by color)
- win: mode dependent (duel is first to 8)
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from datetime import datetime, timezone
from cuid2 import cuid_wrapper
import random

generate_id = cuid_wrapper()


class GamePhase(str, Enum):
    """
    riftbound turn phases (official rules):
    1. ready - awaken: ready all exhausted game objects you control
    2. score - beginning scoring step: holding
    3. channel - channel 2 runes (mode can modify this on first turns)
    4. draw - draw 1 (mode can modify this on first turns)
    5. main - action phase (discretionary actions)
    6. end - end-of-turn cleanup + heal
    """

    READY = "ready"
    SCORE = "score"
    DRAW = "draw"
    CHANNEL = "channel"
    MAIN = "main"
    END = "end"


class ActionType(str, Enum):
    DRAW_CARD = "draw_card"
    CHANNEL_RUNE = "channel_rune"
    TAP_RUNE = "tap_rune"
    RECYCLE_RUNE = "recycle_rune"
    PLAY_CARD = "play_card"
    MOVE_UNIT = "move_unit"
    ATTACK = "attack"
    ACTIVATE_ABILITY = "activate_ability"
    END_PHASE = "end_phase"
    END_TURN = "end_turn"
    CONCEDE = "concede"


class BattlefieldControl(str, Enum):
    """who controls a battlefield"""

    NONE = "none"
    PLAYER1 = "player1"
    PLAYER2 = "player2"
    CONTESTED = "contested"


@dataclass
class CardInstance:
    """
    represents a specific instance of a card in the game.
    """

    instance_id: str
    card_id: str
    owner_id: str

    # card data
    title: str
    card_type: Optional[str]  # unit, spell, gear, rune
    super_type: Optional[str]  # champion, legend
    rarity: str
    set_code: str
    number: int
    tags: list[str] = field(default_factory=list)
    color: Optional[str] = None
    text: Optional[str] = None

    # stats (for units)
    attack: int = 0
    health: int = 0
    might: int = 0

    # costs
    energy_cost: int = 0  # runes to exhaust
    power_cost: dict = field(default_factory=dict)  # color -> count to recycle

    # instance state
    current_health: int = 0
    damage: int = 0
    exhausted: bool = False
    modifiers: list[dict] = field(default_factory=list)
    
    # parsed card data
    parsed_card: Optional[object] = None

    def __post_init__(self):
        if self.current_health == 0:
            self.current_health = self.health

    @classmethod
    def from_card(cls, card, owner_id: str) -> "CardInstance":
        """create instance from card data"""
        energy = getattr(card, "energy", None)
        power = getattr(card, "power", None)
        color = getattr(card, "color", None)
        might = getattr(card, "might", None)
        text = getattr(card, "text", None)

        energy_cost = int(energy) if isinstance(energy, int) else 0
        power_cost = {}
        if isinstance(power, int) and power > 0 and isinstance(color, str) and color:
            power_cost[color.lower()] = power

        # we don't have full unit stat lines yet, so for now we mirror might into both attack/health
        # (real rules use might + damage, but this keeps combat from being totally empty)
        m = int(might) if isinstance(might, int) else 0
        return cls(
            instance_id=generate_id(),
            card_id=card.id,
            owner_id=owner_id,
            title=card.title,
            card_type=(
                (card.card_type or "").lower()
                if getattr(card, "card_type", None)
                else None
            ),
            super_type=(
                (card.super_type or "").lower()
                if getattr(card, "super_type", None)
                else None
            ),
            rarity=(
                (card.rarity or "").lower()
                if getattr(card, "rarity", None)
                else "common"
            ),
            set_code=card.set_code,
            number=card.number,
            tags=card.tags.copy() if card.tags else [],
            color=(color.lower() if isinstance(color, str) and color else None),
            text=(text if isinstance(text, str) else None),
            attack=m or getattr(card, "attack", 0),
            health=m or getattr(card, "health", 0),
            might=m,
            energy_cost=energy_cost,
            power_cost=power_cost,
        )

    def to_dict(self) -> dict:
        return {
            "instanceId": self.instance_id,
            "id": self.card_id,
            "ownerId": self.owner_id,
            "title": self.title,
            "type": self.card_type,
            "superType": self.super_type,
            "rarity": self.rarity,
            "set": self.set_code,
            "number": self.number,
            "tags": self.tags,
            "color": self.color,
            "text": self.text,
            "attack": self.attack,
            "health": self.health,
            "might": self.might,
            "currentHealth": self.current_health,
            "energyCost": self.energy_cost,
            "powerCost": self.power_cost,
            "damage": self.damage,
            "exhausted": self.exhausted,
            "modifiers": self.modifiers,
        }

    def take_damage(self, amount: int) -> bool:
        """apply damage, returns true if destroyed"""
        self.damage += amount
        return self.damage >= self.current_health

    def heal(self, amount: int):
        self.damage = max(0, self.damage - amount)

    def exhaust(self):
        self.exhausted = True

    def ready(self):
        self.exhausted = False

    @property
    def is_destroyed(self) -> bool:
        return self.damage >= self.current_health

    @property
    def is_unit(self) -> bool:
        return self.card_type == "unit"

    @property
    def is_spell(self) -> bool:
        return self.card_type == "spell"

    @property
    def is_rune(self) -> bool:
        return self.card_type == "rune"


@dataclass
class Battlefield:
    """
    represents one of the 3 battlefields players fight over.
    each player can deploy units to each battlefield.
    control is determined by total power on each side.
    """

    id: str
    name: str
    card: Optional[dict] = None

    # units deployed by each player
    player1_units: list[CardInstance] = field(default_factory=list)
    player2_units: list[CardInstance] = field(default_factory=list)

    # who currently controls this battlefield
    control: BattlefieldControl = BattlefieldControl.NONE

    # points scored by controlling this battlefield
    points_value: int = 1

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "card": self.card,
            "player1Units": [u.to_dict() for u in self.player1_units],
            "player2Units": [u.to_dict() for u in self.player2_units],
            "control": self.control.value,
            "pointsValue": self.points_value,
        }

    def get_player_power(self, position: str) -> int:
        """get total attack power for a player's units"""
        units = self.player1_units if position == "player1" else self.player2_units
        return sum(u.attack for u in units if not u.is_destroyed)

    def calculate_control(self) -> BattlefieldControl:
        """determine who controls this battlefield"""
        p1_power = self.get_player_power("player1")
        p2_power = self.get_player_power("player2")

        if p1_power == 0 and p2_power == 0:
            return BattlefieldControl.NONE
        elif p1_power > p2_power:
            return BattlefieldControl.PLAYER1
        elif p2_power > p1_power:
            return BattlefieldControl.PLAYER2
        else:
            return BattlefieldControl.CONTESTED

    def add_unit(self, unit: CardInstance, position: str):
        """add a unit to this battlefield"""
        if position == "player1":
            self.player1_units.append(unit)
        else:
            self.player2_units.append(unit)

    def remove_unit(self, instance_id: str) -> Optional[CardInstance]:
        """remove a unit from this battlefield"""
        for units in [self.player1_units, self.player2_units]:
            for i, unit in enumerate(units):
                if unit.instance_id == instance_id:
                    return units.pop(i)
        return None


@dataclass
class Player:
    """represents a player in the game"""

    id: str
    name: str
    position: str  # "player1" or "player2"

    # champion legend card
    champion: Optional[CardInstance] = None

    # decks
    main_deck: list[CardInstance] = field(default_factory=list)
    rune_deck: list[CardInstance] = field(default_factory=list)

    # zones
    hand: list[CardInstance] = field(default_factory=list)
    runes_in_play: list[CardInstance] = field(default_factory=list)  # channeled runes
    graveyard: list[CardInstance] = field(default_factory=list)

    # base zones
    base_units: list[CardInstance] = field(default_factory=list)
    base_gear: list[CardInstance] = field(default_factory=list)

    # rune pool (resources)
    rune_pool_energy: int = 0
    rune_pool_power: dict = field(default_factory=dict)

    # resources
    score: int = 0

    # turn state
    runes_channeled_this_turn: int = 0

    # connection
    connected: bool = True

    def get_ready_runes(self) -> list[CardInstance]:
        """get all unexhausted runes"""
        return [r for r in self.runes_in_play if not r.exhausted]

    def get_energy(self) -> int:
        """get available energy in the rune pool"""
        return self.rune_pool_energy

    def add_energy(self, amount: int):
        if amount <= 0:
            return
        self.rune_pool_energy += amount

    def spend_energy(self, amount: int) -> bool:
        if amount <= 0:
            return True
        if self.rune_pool_energy < amount:
            return False
        self.rune_pool_energy -= amount
        return True

    def clear_rune_pool(self):
        # rule 163: pool empties at end of draw phase and end of turn
        self.rune_pool_energy = 0
        self.rune_pool_power = {}

    def draw_card(self) -> Optional[CardInstance]:
        """draw a card from main deck"""
        if not self.main_deck:
            return None
        card = self.main_deck.pop(0)
        self.hand.append(card)
        return card

    def channel_rune(self, max_per_turn: int = 2) -> Optional[CardInstance]:
        """channel a rune from rune deck"""
        if not self.rune_deck:
            return None
        if self.runes_channeled_this_turn >= max_per_turn:
            return None
        rune = self.rune_deck.pop(0)
        self.runes_in_play.append(rune)
        self.runes_channeled_this_turn += 1
        return rune

    def pay_energy(self, amount: int) -> bool:
        """legacy: kept for compatibility; energy is now spent from the rune pool"""
        return self.spend_energy(amount)

    def ready_all(self):
        """ready all exhausted runes and base permanents"""
        for rune in self.runes_in_play:
            rune.ready()
        for gear in self.base_gear:
            gear.ready()
        for unit in self.base_units:
            unit.ready()

    def shuffle_deck(self):
        random.shuffle(self.main_deck)

    def shuffle_rune_deck(self):
        random.shuffle(self.rune_deck)

    def reset_turn_state(self):
        """reset per-turn state"""
        self.runes_channeled_this_turn = 0


@dataclass
class GameAction:
    """represents an action taken in the game"""

    id: str
    action_type: ActionType
    player_id: str
    timestamp: datetime
    data: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.action_type.value,
            "playerId": self.player_id,
            "timestamp": self.timestamp.isoformat(),
            "data": self.data,
        }


@dataclass
class GameState:
    """complete state of a riftbound game"""

    id: str
    code: str

    player1: Player
    player2: Player

    # the 3 battlefields
    battlefields: list[Battlefield] = field(default_factory=list)

    # turn state
    # note: these are assigned after battlefield selection during setup
    starting_player: str = ""
    current_turn: str = "player1"
    turn_number: int = 1
    phase: GamePhase = GamePhase.READY

    # setup state (rules 116-118)
    # note: we model mulligan as a pre-game step before the first turn starts
    setup_step: str = "battlefields"  # "battlefields" | "mulligan" | "done"
    mulligan_player: str = "player1"  # whose mulligan is currently active
    battlefield_options: dict = field(
        default_factory=dict
    )  # position -> list[card dict]
    battlefield_selected: dict = field(
        default_factory=dict
    )  # position -> card dict | None

    # game log
    action_log: list[GameAction] = field(default_factory=list)

    # winner
    winner: Optional[str] = None

    # chain state
    chain_items: list[dict] = field(default_factory=list)
    priority_player: Optional[str] = None
    waiting_for_response: bool = False

    # game constants
    # per rules: start with 4 cards, then draw 1 at start of your first turn (so you see 5 on turn 1)
    starting_hand_size: int = 4
    max_hand_size: int = 10
    winning_score: int = 8
    max_runes_per_turn: int = 2

    def get_current_player(self) -> Player:
        return self.player1 if self.current_turn == "player1" else self.player2

    def get_opponent(self, player_id: str) -> Player:
        return self.player2 if self.player1.id == player_id else self.player1

    def get_player(self, player_id: str) -> Optional[Player]:
        if self.player1.id == player_id:
            return self.player1
        if self.player2.id == player_id:
            return self.player2
        return None

    def get_player_by_position(self, position: str) -> Player:
        return self.player1 if position == "player1" else self.player2

    def add_action(self, action_type: ActionType, player_id: str, data: dict = None):
        action = GameAction(
            id=generate_id(),
            action_type=action_type,
            player_id=player_id,
            timestamp=datetime.now(timezone.utc),
            data=data or {},
        )
        self.action_log.append(action)
        return action


def create_initial_state(
    game_id: str,
    code: str,
    player1_id: str,
    player1_name: str,
    player1_deck: dict,
    player2_id: str,
    player2_name: str,
    player2_deck: dict,
) -> GameState:
    """create initial game state from player info and decks"""
    from modules.cards import get_card, get_all_cards

    def find_card(card_id_or_name: str):
        # lol this supports both ids and human names from piltover archive exports
        card = get_card(card_id_or_name)
        if card:
            return card

        def norm(s: str) -> str:
            s = (s or "").lower().strip()
            # normalize apostrophes and punctuation so "targon's peak" matches "targons peak"
            s = s.replace("’", "'")
            out = []
            for ch in s:
                if ch.isalnum():
                    out.append(ch)
                elif ch.isspace():
                    out.append(" ")
            return " ".join("".join(out).split())

        needle = norm(card_id_or_name or "")
        for c in get_all_cards():
            if norm(c.title) == needle:
                return c
        return None

    def build_deck(
        deck_data: dict, owner_id: str
    ) -> tuple[
        list[CardInstance], list[CardInstance], Optional[CardInstance], list[str]
    ]:
        """build main deck + rune deck + legend + battlefields from deck data"""
        main_deck = []
        rune_deck = []
        legend = None
        battlefields: list[str] = []

        # legend (required in real rules, optional here while we iterate)
        legend_entry = deck_data.get("legend")
        if isinstance(legend_entry, dict):
            card = find_card(legend_entry.get("cardId", ""))
            if card:
                legend = CardInstance.from_card(card, owner_id)

        # battlefields (3)
        for entry in deck_data.get("battlefields", []) or []:
            if not isinstance(entry, dict):
                continue
            name = (entry.get("cardId") or "").strip()
            if name:
                battlefields.append(name)

        # main deck entries
        for entry in deck_data.get("mainDeck", []) or []:
            if not isinstance(entry, dict):
                continue
            card = find_card(entry.get("cardId", ""))
            if not card:
                continue
            # never let runes/battlefields/legends leak into the main deck
            ct = (getattr(card, "card_type", "") or "").lower()
            if ct in ["rune", "battlefield", "legend"]:
                continue
            for _ in range(entry.get("count", 1)):
                main_deck.append(CardInstance.from_card(card, owner_id))

        # champion section is sometimes exported separately; treat it as part of the main deck if present
        champion_entry = deck_data.get("champion")
        if isinstance(champion_entry, dict):
            card = find_card(champion_entry.get("cardId", ""))
            if card:
                ct = (getattr(card, "card_type", "") or "").lower()
                if ct not in ["rune", "battlefield", "legend"]:
                    # ok this isn't a rune/bf/legend, let it slide
                    for _ in range(champion_entry.get("count", 1)):
                        main_deck.append(CardInstance.from_card(card, owner_id))

        # rune deck entries
        for entry in deck_data.get("runeDeck", []) or []:
            if not isinstance(entry, dict):
                continue
            card = find_card(entry.get("cardId", ""))
            if not card:
                continue
            # only allow actual rune cards in rune deck
            ct = (getattr(card, "card_type", "") or "").lower()
            if ct != "rune":
                continue
            for _ in range(entry.get("count", 1)):
                rune_deck.append(CardInstance.from_card(card, owner_id))

        return main_deck, rune_deck, legend, battlefields

    # build player decks
    p1_main, p1_runes, p1_legend, p1_battlefields = build_deck(player1_deck, player1_id)
    p2_main, p2_runes, p2_legend, p2_battlefields = build_deck(player2_deck, player2_id)

    player1 = Player(
        id=player1_id,
        name=player1_name,
        position="player1",
        champion=p1_legend,
        main_deck=p1_main,
        rune_deck=p1_runes,
    )

    player2 = Player(
        id=player2_id,
        name=player2_name,
        position="player2",
        champion=p2_legend,
        main_deck=p2_main,
        rune_deck=p2_runes,
    )

    # shuffle decks
    player1.shuffle_deck()
    player1.shuffle_rune_deck()
    player2.shuffle_deck()
    player2.shuffle_rune_deck()

    # duel mode battlefield selection:
    # players pick 1 of their 3 battlefields before turn order is assigned (per your instruction)
    def battlefield_card(raw: str) -> Optional[dict]:
        card = find_card(raw)
        if not card:
            return None
        return {
            "id": card.id,
            "title": card.title,
            "type": "battlefield",
            "superType": getattr(card, "super_type", None),
            "rarity": (getattr(card, "rarity", "") or "uncommon").lower(),
            "set": getattr(card, "set_code", ""),
            "number": getattr(card, "number", 0),
            "orientation": getattr(card, "orientation", "landscape"),
            "tags": getattr(card, "tags", None),
        }

    return GameState(
        id=game_id,
        code=code,
        player1=player1,
        player2=player2,
        battlefields=[],
        starting_player="",
        current_turn="player1",
        setup_step="battlefields",
        mulligan_player="player1",
        battlefield_options={
            "player1": [c for c in [battlefield_card(x) for x in p1_battlefields] if c],
            "player2": [c for c in [battlefield_card(x) for x in p2_battlefields] if c],
        },
        battlefield_selected={"player1": None, "player2": None},
    )
