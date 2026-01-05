"""
riftbound game engine.

implements official riftbound rules:
- turn structure: awaken → beginning (scoring) → channel → draw → action → end
- resources: energy (exhaust runes), power (recycle runes)
- win condition: mode dependent (default duel uses victory score 8)
"""

from typing import Optional, Callable
import random
from .state import (
    GameState,
    GamePhase,
    ActionType,
    CardInstance,
    Player,
    BattlefieldControl,
    Battlefield,
)
from .parser import CardTextParser
from .chain import ChainManager, PriorityManager
from .combat import CombatManager, ShowdownManager
from .scoring import ControlManager
from .effects.base import EffectContext
from .triggers.base import TriggerEvent, TriggerType


class GameEngine:
    """
    core game engine that processes commands and enforces riftbound rules.

    turn structure (rules 314-317):
    1. awaken - ready controlled game objects
    2. beginning - scoring step (holding)
    3. channel - channel 2 runes from rune deck
    4. draw - draw 1 from main deck (with mode-specific first turn exceptions)
    5. action - take discretionary actions (play cards, move, etc)
    6. end - end-of-turn cleanup + heal
    """

    def __init__(self, state: GameState):
        self.state = state
        self._event_handlers: list[Callable] = []
        
        self.parser = CardTextParser()
        self.chain_manager = ChainManager(state)
        self.chain_manager.set_emit_callback(self._emit)
        self.priority_manager = PriorityManager(state)
        self.combat_manager = CombatManager(state)
        self.combat_manager.set_emit_callback(self._emit)
        self.showdown_manager = ShowdownManager(state)
        self.showdown_manager.set_emit_callback(self._emit)
        self.control_manager = ControlManager(state)
        self.control_manager.set_emit_callback(self._emit)
        
        self._trigger_registry: list[tuple[CardInstance, object]] = []

    def on_event(self, handler: Callable):
        """register event handler for broadcasting"""
        self._event_handlers.append(handler)

    def _emit(self, event_type: str, data: dict):
        """emit event to all handlers"""
        for handler in self._event_handlers:
            try:
                handler(event_type, data)
            except Exception as e:
                print(f"event handler error: {e}")

    # === initialization ===
    
    def parse_card(self, card: CardInstance):
        if card.text and not card.parsed_card:
            parsed = self.parser.parse(card.text)
            card.parsed_card = parsed
            
            if parsed.entry_state == "exhausted":
                card.exhausted = True
            
            for keyword in parsed.keywords:
                from .parser.keywords import KeywordHandler
                KeywordHandler.apply_keyword_effect(keyword, card)

    def draw_initial_hands(self):
        """setup: each player draws 4 (rule 116)"""
        for _ in range(self.state.starting_hand_size):
            self.state.player1.draw_card()
            self.state.player2.draw_card()
        
        for card in self.state.player1.hand + self.state.player2.hand:
            self.parse_card(card)
        
        for card in self.state.player1.deck + self.state.player2.deck:
            self.parse_card(card)
    
    def register_triggers(self, card: CardInstance):
        if not card.parsed_card:
            return
        
        for trigger in card.parsed_card.triggers:
            self._trigger_registry.append((card, trigger))
    
    def fire_triggers(self, event: TriggerEvent):
        for card, trigger in self._trigger_registry:
            if trigger.should_trigger(event, self.state):
                context = EffectContext(
                    state=self.state,
                    source_card=card,
                    controller=self.state.get_player(card.owner_id)
                )
                
                result = trigger.effect.execute(context)
                
                self._emit("trigger_fired", {
                    "card": card.title,
                    "trigger": str(trigger),
                    "result": result
                })

    def _run_start_of_turn(self):
        """run start-of-turn phases automatically so you land in action phase"""
        # only do this once setup is done
        if self.state.setup_step != "done":
            return

        # ready -> score -> channel -> draw -> main
        for phase in [
            GamePhase.READY,
            GamePhase.SCORE,
            GamePhase.CHANNEL,
            GamePhase.DRAW,
            GamePhase.MAIN,
        ]:
            self.state.phase = phase
            self._on_phase_enter()
            self._emit("phase_changed", {"phase": self.state.phase.value})

    # === phase management ===

    def advance_phase(self):
        """move to next phase"""
        phase_order = [
            GamePhase.READY,
            GamePhase.SCORE,
            GamePhase.CHANNEL,
            GamePhase.DRAW,
            GamePhase.MAIN,
            GamePhase.END,
        ]

        current_idx = phase_order.index(self.state.phase)

        if current_idx == len(phase_order) - 1:
            # end of turn
            self._end_turn()
        else:
            self.state.phase = phase_order[current_idx + 1]
            self._on_phase_enter()

        self._emit("phase_changed", {"phase": self.state.phase.value})

    def _on_phase_enter(self):
        """handle automatic phase actions"""
        player = self.state.get_current_player()

        if self.state.phase == GamePhase.READY:
            # awaken: ready all exhausted runes + units (rule 315.1)
            player.ready_all()

            # ready all units on battlefields
            for bf in self.state.battlefields:
                units = (
                    bf.player1_units
                    if player.position == "player1"
                    else bf.player2_units
                )
                for unit in units:
                    unit.ready()

        elif self.state.phase == GamePhase.SCORE:
            # beginning scoring step: holding (rule 315.2.b)
            self._calculate_scores()

            # check for victory
            if player.score >= self.state.winning_score:
                self._declare_winner(player.position)

        elif self.state.phase == GamePhase.CHANNEL:
            # channel phase: automatically channel 2 runes (rule 315.3)
            # duel first turn tweak: player going second channels an extra rune on their first channel phase (rule 462.7)
            max_to_channel = 2
            if (
                self.state.turn_number == 2
                and player.position != self.state.starting_player
            ):
                max_to_channel = 3

            for _ in range(max_to_channel):
                rune = player.channel_rune(max_per_turn=max_to_channel)
                if not rune:
                    break
                self.state.add_action(
                    ActionType.CHANNEL_RUNE, player.id, {"runeName": rune.title}
                )

        elif self.state.phase == GamePhase.DRAW:
            # draw phase: draw 1 (rule 315.4) - mode-specific first turn exceptions not implemented yet
            card = player.draw_card()
            if card:
                self.state.add_action(
                    ActionType.DRAW_CARD, player.id, {"cardName": card.title}
                )
            # rule 315.4.d: as draw phase ends, rune pool empties
            player.clear_rune_pool()

    def _calculate_scores(self):
        """calculate battlefield control and award points"""
        player = self.state.get_current_player()
        points_earned = 0

        for bf in self.state.battlefields:
            bf.control = bf.calculate_control()

            # award point if player controls this battlefield
            if bf.control.value == player.position:
                points_earned += bf.points_value

        if points_earned > 0:
            player.score += points_earned
            self.state.add_action(
                ActionType.DRAW_CARD,  # reusing for now
                player.id,
                {"type": "score", "points": points_earned, "total": player.score},
            )

    def _end_turn(self):
        """end current turn and switch players"""
        player = self.state.get_current_player()

        # discard down to max hand size
        while len(player.hand) > self.state.max_hand_size:
            card = player.hand.pop()
            player.graveyard.append(card)

        # end of turn: heal all units (rule 317.2.b inserts heal all units)
        for bf in self.state.battlefields:
            for u in bf.player1_units + bf.player2_units:
                u.damage = 0
        # end of turn: rune pool empties (rule 317.3.b)
        player.clear_rune_pool()

        # reset turn state
        player.reset_turn_state()

        # switch turns
        self.state.current_turn = (
            "player2" if self.state.current_turn == "player1" else "player1"
        )
        self.state.turn_number += 1
        self.state.phase = GamePhase.READY

        self._emit("turn_changed", {"player": self.state.current_turn})
        # run the new turn's start-of-turn phases automatically
        self._run_start_of_turn()

    def _declare_winner(self, position: str):
        """declare winner and end game"""
        self.state.winner = position
        self._emit("game_over", {"winner": position})

    # === command processing ===

    def process_command(self, player_id: str, command: dict) -> dict:
        """process a command from a player"""
        player = self.state.get_player(player_id)
        if not player:
            return {"success": False, "error": "player not found"}

        # setup-only commands happen before turns start
        if self.state.setup_step != "done":
            cmd_type = command.get("type")
            if self.state.setup_step == "battlefields":
                if cmd_type != "choose_battlefield":
                    return {
                        "success": False,
                        "error": "game is in setup (battlefields)",
                    }  # lol pick your map first
                return self._cmd_choose_battlefield(player, command)
            if self.state.setup_step == "mulligan":
                if cmd_type != "mulligan":
                    return {
                        "success": False,
                        "error": "game is in setup (mulligan)",
                    }  # lol no actions yet
                return self._cmd_mulligan(player, command)
            return {"success": False, "error": "game is in setup"}  # fallback

        current = self.state.get_current_player()
        cmd_type = command.get("type")

        # concede works anytime
        if cmd_type == "concede":
            return self._cmd_concede(player)

        if self.state.waiting_for_response:
            if cmd_type == "pass_priority":
                return self._cmd_pass_priority(player)
            if cmd_type == "play_card":
                if not self.priority_manager.has_priority(player):
                    return {"success": False, "error": "you don't have priority"}
                return self._cmd_play_card(player, command)
            return {"success": False, "error": "waiting for responses"}

        # check turn
        if player.id != current.id:
            return {"success": False, "error": "not your turn"}

        # route command
        if cmd_type == "end_phase":
            return self._cmd_end_phase(player)
        elif cmd_type == "end_turn":
            return self._cmd_end_turn(player)
        elif cmd_type == "tap_rune":
            return self._cmd_tap_rune(player, command)
        elif cmd_type == "channel_rune":
            return self._cmd_channel_rune(player)
        elif cmd_type == "activate_ability":
            return self._cmd_activate_ability(player, command)
        elif cmd_type == "play_card":
            return self._cmd_play_card(player, command)
        elif cmd_type == "move":
            return self._cmd_move(player, command)
        elif cmd_type == "pass_priority":
            return self._cmd_pass_priority(player)
        elif cmd_type == "attack":
            return self._cmd_attack(player, command)
        else:
            return {"success": False, "error": f"unknown command: {cmd_type}"}

    def _cmd_activate_ability(self, player: Player, command: dict) -> dict:
        """
        minimal text-driven ability support:
        - if a permanent in your base has a `T:` ability in its rules text, allow activating it by exhausting it
        """
        if self.state.phase != GamePhase.MAIN:
            return {
                "success": False,
                "error": "can only activate abilities during main phase for now",
            }

        instance_id = command.get("instanceId")
        if not isinstance(instance_id, str) or not instance_id:
            return {"success": False, "error": "instanceId required"}

        # search base gear + base units
        card = next(
            (c for c in player.base_gear if c.instance_id == instance_id), None
        ) or next((c for c in player.base_units if c.instance_id == instance_id), None)
        if not card:
            return {"success": False, "error": "card not found in base"}

        text = (card.text or "").strip()
        if "T:" not in text and not text.startswith("T:"):
            return {"success": False, "error": "no tappable ability on this card"}

        if card.exhausted:
            return {"success": False, "error": "already exhausted"}

        card.exhaust()
        self.state.add_action(
            ActionType.ACTIVATE_ABILITY,
            player.id,
            {"cardName": card.title, "ability": "T:"},
        )
        # actual effect resolution is todo, but the tap cost is now real
        return {"success": True}

    def _cmd_tap_rune(self, player: Player, command: dict) -> dict:
        """tap (exhaust) a rune to add 1 energy to your rune pool"""
        if self.state.phase != GamePhase.MAIN:
            return {
                "success": False,
                "error": "can only tap runes during main phase for now",
            }
        rune_id = command.get("runeInstanceId")
        if not isinstance(rune_id, str) or not rune_id:
            return {"success": False, "error": "runeInstanceId required"}
        rune = next((r for r in player.runes_in_play if r.instance_id == rune_id), None)
        if not rune:
            return {"success": False, "error": "rune not found"}
        if rune.exhausted:
            return {"success": False, "error": "rune already exhausted"}

        rune.exhaust()
        player.add_energy(1)
        self.state.add_action(
            ActionType.TAP_RUNE,
            player.id,
            {"runeName": rune.title, "energy": player.get_energy()},
        )
        return {"success": True}

    def _auto_pay_energy(self, player: Player, energy_needed: int) -> bool:
        """automatically tap ready runes until the pool can cover energy_needed"""
        if energy_needed <= 0:
            return True
        if player.get_energy() >= energy_needed:
            return True

        ready = [r for r in player.runes_in_play if not r.exhausted]
        while player.get_energy() < energy_needed and ready:
            rune = ready.pop(0)
            rune.exhaust()
            player.add_energy(1)
            self.state.add_action(
                ActionType.TAP_RUNE,
                player.id,
                {"runeName": rune.title, "energy": player.get_energy()},
            )

        return player.get_energy() >= energy_needed

    def _auto_pay_power(self, player: Player, power_cost: dict) -> bool:
        """automatically recycle matching-color runes from play into the rune deck to satisfy power_cost"""
        if not power_cost:
            return True

        for color, need in power_cost.items():
            need_n = int(need)
            if need_n <= 0:
                continue

            matching = [
                r
                for r in player.runes_in_play
                if (r.color or "").lower() == str(color).lower()
            ]
            if len(matching) < need_n:
                return False

            for i in range(need_n):
                rune = matching[i]
                try:
                    player.runes_in_play.remove(rune)
                except ValueError:
                    continue
                player.rune_deck.append(rune)
                self.state.add_action(
                    ActionType.RECYCLE_RUNE,
                    player.id,
                    {"runeName": rune.title, "color": str(color).lower()},
                )

        return True

    def _cmd_mulligan(self, player: Player, command: dict) -> dict:
        """mulligan up to 2 cards, then recycle them (rules 117-117.3)"""
        if self.state.setup_step != "mulligan":
            return {"success": False, "error": "not in mulligan"}
        if player.position != self.state.mulligan_player:
            return {"success": False, "error": "not your mulligan"}

        ids = command.get("cardInstanceIds") or []
        if not isinstance(ids, list):
            return {"success": False, "error": "cardInstanceIds must be a list"}

        # max 2 cards (rule 117.1)
        ids = [str(x) for x in ids][:2]

        set_aside: list[CardInstance] = []
        if ids:
            remaining_hand: list[CardInstance] = []
            for c in player.hand:
                if c.instance_id in ids:
                    set_aside.append(c)
                else:
                    remaining_hand.append(c)
            player.hand = remaining_hand

        # draw same count (rule 117.2)
        for _ in range(len(set_aside)):
            player.draw_card()

        # recycle set aside to bottom of main deck in random order (rule 117.3 + 403.5)
        random.shuffle(set_aside)
        player.main_deck.extend(set_aside)

        self.state.add_action(
            ActionType.END_PHASE,
            player.id,
            {"type": "mulligan", "count": len(set_aside)},
        )

        # next player's mulligan, then start the game
        next_player = (
            "player2" if self.state.mulligan_player == "player1" else "player1"
        )
        if next_player == self.state.starting_player:
            # both players completed (since we started with starting_player)
            self.state.setup_step = "done"
        self.state.mulligan_player = next_player

        # once setup is done, run the first turn's start-of-turn phases automatically
        if self.state.setup_step == "done":
            self._run_start_of_turn()

        return {
            "success": True,
            "setup": {
                "step": self.state.setup_step,
                "mulliganPlayer": self.state.mulligan_player,
            },
        }

    def _cmd_choose_battlefield(self, player: Player, command: dict) -> dict:
        """each player picks one battlefield before turn order is assigned"""
        if self.state.setup_step != "battlefields":
            return {"success": False, "error": "not in battlefield selection"}

        card_id = command.get("cardId")
        if not isinstance(card_id, str) or not card_id.strip():
            return {"success": False, "error": "cardId required"}

        options = self.state.battlefield_options.get(player.position, []) or []
        chosen = None
        for c in options:
            if isinstance(c, dict) and c.get("id") == card_id:
                chosen = c
                break
        if not chosen:
            return {"success": False, "error": "invalid battlefield choice"}

        self.state.battlefield_selected[player.position] = chosen

        # if both players picked, finalize setup: decide turn order, deal hands, go to mulligan
        p1_choice = self.state.battlefield_selected.get("player1")
        p2_choice = self.state.battlefield_selected.get("player2")
        if p1_choice and p2_choice:
            self.state.battlefields = [
                # bf1 is p1's battlefield, bf2 is p2's battlefield (duel)
                Battlefield(
                    id="bf1",
                    name=p1_choice.get("title", "battlefield"),
                    card=p1_choice,
                    points_value=1,
                ),
                Battlefield(
                    id="bf2",
                    name=p2_choice.get("title", "battlefield"),
                    card=p2_choice,
                    points_value=1,
                ),
            ]

            # turn order is assigned after battlefields are picked
            self.state.starting_player = random.choice(["player1", "player2"])
            self.state.current_turn = self.state.starting_player
            self.state.turn_number = 1
            self.state.phase = GamePhase.READY

            # now draw 4 then do mulligans
            self.draw_initial_hands()
            self.state.setup_step = "mulligan"
            self.state.mulligan_player = self.state.starting_player

        return {"success": True}

    def _cmd_end_phase(self, player: Player) -> dict:
        """end current phase"""
        self.state.add_action(ActionType.END_PHASE, player.id)
        self.advance_phase()
        return {"success": True}

    def _cmd_end_turn(self, player: Player) -> dict:
        """end turn (skip remaining phases)"""
        self.state.add_action(ActionType.END_TURN, player.id)
        self._end_turn()
        return {"success": True}

    def _cmd_channel_rune(self, player: Player) -> dict:
        """channel a rune from rune deck"""
        if self.state.phase != GamePhase.CHANNEL:
            return {
                "success": False,
                "error": "can only channel runes during channel phase",
            }

        if player.runes_channeled_this_turn >= self.state.max_runes_per_turn:
            return {
                "success": False,
                "error": f"can only channel {self.state.max_runes_per_turn} runes per turn",
            }

        rune = player.channel_rune()
        if not rune:
            return {"success": False, "error": "no runes left in deck"}

        self.state.add_action(
            ActionType.CHANNEL_RUNE, player.id, {"runeName": rune.title}
        )
        return {"success": True}

    def _cmd_play_card(self, player: Player, command: dict) -> dict:
        """play a card from hand"""
        if self.state.phase != GamePhase.MAIN:
            return {"success": False, "error": "can only play cards during main phase"}

        instance_id = command.get("cardInstanceId")
        battlefield_id = command.get("battlefieldId")
        target_id = command.get("targetInstanceId")

        card = None
        card_idx = None
        for i, c in enumerate(player.hand):
            if c.instance_id == instance_id:
                card = c
                card_idx = i
                break

        if not card:
            return {"success": False, "error": "card not in hand"}

        self.parse_card(card)

        if self.state.waiting_for_response:
            if not card.is_spell:
                return {"success": False, "error": "can only respond with Reaction spells"}
            from .parser.keywords import Keyword
            keywords = (card.parsed_card.keywords if card.parsed_card else []) or []
            if not any(k.keyword == Keyword.REACTION for k in keywords):
                return {"success": False, "error": "can only respond with Reaction spells"}

        if not self._auto_pay_power(player, card.power_cost):
            return {
                "success": False,
                "error": "not enough matching-color runes in play to pay power",
            }

        if not self._auto_pay_energy(player, card.energy_cost):
            return {"success": False, "error": "not enough runes to tap for energy"}
        if card.energy_cost > 0 and not player.spend_energy(card.energy_cost):
            return {"success": False, "error": "failed to spend energy"}

        player.hand.pop(card_idx)

        if card.is_unit:
            if battlefield_id:
                bf = next(
                    (b for b in self.state.battlefields if b.id == battlefield_id), None
                )
                if not bf:
                    player.hand.insert(card_idx, card)
                    return {"success": False, "error": "invalid battlefield"}
                if bf.control.value != player.position:
                    player.hand.insert(card_idx, card)
                    return {
                        "success": False,
                        "error": "can only play units to your base or a battlefield you control",
                    }
                bf.add_unit(card, player.position)
                card.exhaust()
            else:
                player.base_units.append(card)
                card.exhaust()

            self.register_triggers(card)

            event = TriggerEvent(
                trigger_type=TriggerType.PLAY,
                source=card,
                player_id=player.id,
            )
            self.fire_triggers(event)

        elif card.is_spell:
            self.chain_manager.add_to_chain(card, player, target_id=target_id)

            opponent = self.state.get_opponent(player.id)
            self.priority_manager.give_priority_to(opponent)
            self.state.waiting_for_response = True

            self.state.add_action(
                ActionType.PLAY_CARD,
                player.id,
                {"cardName": card.title, "battlefield": battlefield_id},
            )

            self._emit(
                "chain_updated",
                {"chain": self.state.chain_items, "priorityPlayer": opponent.id},
            )

            return {"success": True, "waitingForResponse": True}

        elif card.card_type == "gear":
            player.base_gear.append(card)
            card.ready()
        else:
            player.graveyard.append(card)

        self.state.add_action(
            ActionType.PLAY_CARD,
            player.id,
            {"cardName": card.title, "battlefield": battlefield_id},
        )
        return {"success": True}

    def _cmd_pass_priority(self, player: Player) -> dict:
        if not self.state.waiting_for_response:
            return {"success": False, "error": "not waiting for response"}

        if not self.priority_manager.has_priority(player):
            return {"success": False, "error": "you don't have priority"}

        all_passed = self.priority_manager.pass_priority(player)

        if all_passed:
            self.chain_manager.resolve_chain()
            self.state.waiting_for_response = False
            self.priority_manager.reset()
            self.state.priority_player = None
        else:
            self.state.priority_player = self.priority_manager.priority_player_id
            self._emit(
                "priority_changed", {"priorityPlayer": self.priority_manager.priority_player_id}
            )

        return {"success": True}

    def _cmd_move(self, player: Player, command: dict) -> dict:
        if self.state.phase != GamePhase.MAIN:
            return {"success": False, "error": "can only move during main phase"}

        unit_id = command.get("unitInstanceId")
        destination = command.get("destination")

        if not isinstance(unit_id, str) or not unit_id:
            return {"success": False, "error": "unitInstanceId required"}
        if not isinstance(destination, str) or not destination:
            return {"success": False, "error": "destination required"}

        unit = None
        source_bf = None

        for u in player.base_units:
            if u.instance_id == unit_id:
                unit = u
                break

        if not unit:
            for bf in self.state.battlefields:
                units = bf.player1_units if player.position == "player1" else bf.player2_units
                for u in units:
                    if u.instance_id == unit_id:
                        unit = u
                        source_bf = bf
                        break
                if unit:
                    break

        if not unit:
            return {"success": False, "error": "unit not found"}

        if unit.exhausted:
            return {"success": False, "error": "unit is exhausted"}

        if source_bf is None:
            if destination == "base":
                return {"success": False, "error": "unit is already at base"}
            bf = next((b for b in self.state.battlefields if b.id == destination), None)
            if not bf:
                return {"success": False, "error": "invalid destination"}
            try:
                player.base_units.remove(unit)
            except ValueError:
                return {"success": False, "error": "unit not found"}
            bf.add_unit(unit, player.position)
        else:
            if destination == "base":
                removed = source_bf.remove_unit(unit_id)
                if not removed:
                    return {"success": False, "error": "unit not found"}
                player.base_units.append(removed)
            else:
                return {
                    "success": False,
                    "error": "cannot move between battlefields without Ganking",
                }

        unit.exhaust()

        self.state.add_action(
            ActionType.MOVE_UNIT,
            player.id,
            {"unitName": unit.title, "destination": destination},
        )

        self._emit(
            "unit_moved",
            {
                "unitInstanceId": unit.instance_id,
                "player": player.position,
                "destination": destination,
            },
        )

        return {"success": True}

    def _cmd_attack(self, player: Player, command: dict) -> dict:
        """attack with a unit"""
        if self.state.phase != GamePhase.MAIN:
            return {"success": False, "error": "can only attack during main phase"}

        attacker_id = command.get("attackerId")
        target_id = command.get("targetId")
        battlefield_id = command.get("battlefieldId")

        # find battlefield
        bf = None
        for b in self.state.battlefields:
            if b.id == battlefield_id:
                bf = b
                break

        if not bf:
            return {"success": False, "error": "battlefield not found"}

        # find attacker
        my_units = (
            bf.player1_units if player.position == "player1" else bf.player2_units
        )
        attacker = None
        for u in my_units:
            if u.instance_id == attacker_id:
                attacker = u
                break

        if not attacker:
            return {"success": False, "error": "attacker not found"}

        if attacker.exhausted:
            return {"success": False, "error": "attacker is exhausted"}

        # find target
        opponent = self.state.get_opponent(player.id)
        enemy_units = (
            bf.player2_units if player.position == "player1" else bf.player1_units
        )

        target = None
        for u in enemy_units:
            if u.instance_id == target_id:
                target = u
                break

        if not target:
            return {"success": False, "error": "target not found"}

        # combat
        target_destroyed = target.take_damage(attacker.attack)
        attacker_destroyed = attacker.take_damage(target.attack)

        # remove destroyed units
        if target_destroyed:
            bf.remove_unit(target_id)
            opponent.graveyard.append(target)

        if attacker_destroyed:
            bf.remove_unit(attacker_id)
            player.graveyard.append(attacker)

        attacker.exhaust()

        self.state.add_action(
            ActionType.ATTACK,
            player.id,
            {
                "attacker": attacker.title,
                "target": target.title,
                "battlefield": bf.name,
            },
        )
        return {"success": True}

    def _cmd_concede(self, player: Player) -> dict:
        """concede game"""
        winner = "player2" if player.position == "player1" else "player1"
        self.state.add_action(ActionType.CONCEDE, player.id)
        self._declare_winner(winner)
        return {"success": True}
