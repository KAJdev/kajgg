import type { Card } from "./card";

/**
 * riftbound game phases (official rules):
 * 1. ready - awaken (ready controlled game objects)
 * 2. score - beginning scoring step (holding)
 * 3. channel - channel 2 runes (mode can modify first turn)
 * 4. draw - draw 1 (mode can modify first turn)
 * 5. main - action phase (discretionary actions)
 * 6. end - end-of-turn cleanup + heal
 */
export type GamePhase = 
  | "ready"
  | "score"
  | "channel"
  | "draw"
  | "main"
  | "end";

export type PlayerPosition = "player1" | "player2";
export type BattlefieldControl = "none" | "player1" | "player2" | "contested";

export interface CardInstance extends Card {
  instanceId: string;
  ownerId: string;
  currentHealth: number;
  damage: number;
  exhausted: boolean;
  modifiers: CardModifier[];
  energyCost: number;
  powerCost: Record<string, number>;
}

export interface CardModifier {
  id: string;
  type: "buff" | "debuff" | "status";
  name: string;
  value?: number;
  duration?: number;
}

export interface ChainItem {
  cardTitle: string;
  controllerId: string;
  targetId?: string | null;
}

export interface Battlefield {
  id: string;
  name: string;
  card?: Card | null;
  player1Units: CardInstance[];
  player2Units: CardInstance[];
  control: BattlefieldControl;
  pointsValue: number;
}

export interface Player {
  id: string;
  name: string;
  position: PlayerPosition;
  connected: boolean;
  
  // resources
  score: number;
  energy: number;
  
  // deck sizes
  mainDeckSize: number;
  runeDeckSize: number;
  handSize: number;
  
  // zones (hand only visible to owner)
  hand: CardInstance[];
  runesInPlay: CardInstance[];
  baseUnits?: CardInstance[];
  baseGear?: CardInstance[];
  graveyard: CardInstance[];
  
  // champion
  champion: CardInstance | null;
}

export interface GameState {
  id: string;
  code: string;
  status: "waiting" | "active" | "finished";
  
  player1: Player | null;
  player2: Player | null;
  
  // the 3 battlefields
  battlefields: Battlefield[];
  
  // turn state
  currentTurn: PlayerPosition;
  turnNumber: number;
  phase: GamePhase;

  // chain/priority
  chainItems: ChainItem[];
  priorityPlayer: string | null;
  waitingForResponse: boolean;

  // setup state (mulligan etc)
  setup?: {
    step: "battlefields" | "mulligan" | "done";
    mulliganPlayer: PlayerPosition;
    battlefieldOptions?: Record<PlayerPosition, Card[]>;
    battlefieldSelected?: Record<PlayerPosition, Card | null>;
  } | null;
  
  // game log
  actionLog: GameAction[];
  
  // winner
  winner: PlayerPosition | null;
  
  // timestamps
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface GameAction {
  id: string;
  type: GameActionType;
  playerId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export type GameActionType =
  | "draw_card"
  | "channel_rune"
  | "play_card"
  | "move_unit"
  | "attack"
  | "activate_ability"
  | "end_phase"
  | "end_turn"
  | "concede";

// websocket events
export type GameEvent =
  | { type: "game_state"; state: GameState }
  | { type: "game_started"; state: GameState }
  | { type: "player_joined"; player: { id: string; connected: boolean } }
  | { type: "player_left"; playerId: string }
  | { type: "action"; action: GameAction }
  | { type: "phase_changed"; phase: GamePhase }
  | { type: "turn_changed"; player: PlayerPosition }
  | { type: "chain_updated"; chain: ChainItem[]; priorityPlayer: string }
  | { type: "priority_changed"; priorityPlayer: string }
  | { type: "chain_resolved"; chain_size: number }
  | { type: "game_over"; winner: PlayerPosition }
  | { type: "error"; message: string };

// commands sent to server
export type GameCommand =
  | { type: "draw_card" }
  | { type: "channel_rune" }
  | { type: "play_card"; cardInstanceId: string; battlefieldId?: string; targetInstanceId?: string }
  | { type: "move"; unitInstanceId: string; destination: string }
  | { type: "pass_priority" }
  | { type: "attack"; attackerId: string; targetId: string; battlefieldId: string }
  | { type: "choose_battlefield"; cardId: string }
  | { type: "mulligan"; cardInstanceIds: string[] }
  | { type: "end_phase" }
  | { type: "end_turn" }
  | { type: "concede" };
