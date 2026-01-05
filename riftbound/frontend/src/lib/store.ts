import { create } from "zustand";
import type {
  Card,
  GameState,
  Player,
  Deck,
  GameEvent,
  GamePhase,
  PlayerPosition,
  CardInstance,
} from "@/types";

interface GameStore {
  // connection
  connected: boolean;
  connecting: boolean;
  socket: WebSocket | null;

  // game
  gameState: GameState | null;
  myPlayerId: string | null;

  // ui
  selectedCard: CardInstance | null;
  selectedBattlefield: string | null;

  // cards database
  cards: Map<string, Card>;
  cardsLoaded: boolean;

  // deck
  currentDeck: Deck | null;

  // actions
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setSocket: (socket: WebSocket | null) => void;
  setGameState: (state: GameState | null) => void;
  setMyPlayerId: (id: string | null) => void;
  setSelectedCard: (card: CardInstance | null) => void;
  setSelectedBattlefield: (id: string | null) => void;
  setCards: (cards: Card[]) => void;
  setCurrentDeck: (deck: Deck | null) => void;

  // getters
  getMyPlayer: () => Player | null;
  getOpponentPlayer: () => Player | null;
  isMyTurn: () => boolean;
  getCurrentPhase: () => GamePhase | null;

  // game actions
  sendCommand: (command: unknown) => void;
  handleEvent: (event: GameEvent) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  connected: false,
  connecting: false,
  socket: null,
  gameState: null,
  myPlayerId: null,
  selectedCard: null,
  selectedBattlefield: null,
  cards: new Map(),
  cardsLoaded: false,
  currentDeck: null,

  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setSocket: (socket) => set({ socket }),
  setGameState: (state) => set({ gameState: state }),
  setMyPlayerId: (id) => set({ myPlayerId: id }),
  setSelectedCard: (card) => set({ selectedCard: card }),
  setSelectedBattlefield: (id) => set({ selectedBattlefield: id }),
  setCards: (cards) =>
    set({
      cards: new Map(cards.map((c) => [c.id, c])),
      cardsLoaded: true,
    }),
  setCurrentDeck: (deck) => set({ currentDeck: deck }),

  getMyPlayer: () => {
    const { gameState, myPlayerId } = get();
    if (!gameState || !myPlayerId) return null;
    if (gameState.player1?.id === myPlayerId) return gameState.player1;
    if (gameState.player2?.id === myPlayerId) return gameState.player2;
    return null;
  },

  getOpponentPlayer: () => {
    const { gameState, myPlayerId } = get();
    if (!gameState || !myPlayerId) return null;
    if (gameState.player1?.id === myPlayerId) return gameState.player2;
    if (gameState.player2?.id === myPlayerId) return gameState.player1;
    return null;
  },

  isMyTurn: () => {
    const { gameState, myPlayerId } = get();
    if (!gameState || !myPlayerId) return false;
    const myPosition =
      gameState.player1?.id === myPlayerId ? "player1" : "player2";
    return gameState.currentTurn === myPosition;
  },

  getCurrentPhase: () => {
    const { gameState } = get();
    return gameState?.phase ?? null;
  },

  sendCommand: (command) => {
    const { socket, connected } = get();
    if (socket && connected) {
      socket.send(JSON.stringify(command));
    }
  },

  handleEvent: (event) => {
    console.log("[store] handling event:", event.type);

    switch (event.type) {
      case "game_state":
      case "game_started":
        console.log("[store] updating game state, status:", event.state.status);
        set({ gameState: event.state });
        break;

      case "player_joined":
        set((state) => {
          if (!state.gameState) return state;
          const newState = { ...state.gameState };

          if (newState.player1?.id === event.player.id) {
            newState.player1 = {
              ...newState.player1,
              connected: event.player.connected,
            };
          } else if (newState.player2?.id === event.player.id) {
            newState.player2 = {
              ...newState.player2,
              connected: event.player.connected,
            };
          }

          return { gameState: newState };
        });
        break;

      case "player_left":
        set((state) => {
          if (!state.gameState) return state;
          const newState = { ...state.gameState };

          if (newState.player1?.id === event.playerId) {
            newState.player1 = { ...newState.player1, connected: false };
          } else if (newState.player2?.id === event.playerId) {
            newState.player2 = { ...newState.player2, connected: false };
          }

          return { gameState: newState };
        });
        break;

      case "phase_changed":
        set((state) => {
          if (!state.gameState) return state;
          return { gameState: { ...state.gameState, phase: event.phase } };
        });
        break;

      case "turn_changed":
        set((state) => {
          if (!state.gameState) return state;
          return {
            gameState: {
              ...state.gameState,
              currentTurn: event.player,
              turnNumber: state.gameState.turnNumber + 1,
            },
          };
        });
        break;

      case "chain_updated":
        set((state) => {
          if (!state.gameState) return state;
          return {
            gameState: {
              ...state.gameState,
              chainItems: event.chain,
              priorityPlayer: event.priorityPlayer,
              waitingForResponse: true,
            },
          };
        });
        break;

      case "priority_changed":
        set((state) => {
          if (!state.gameState) return state;
          return {
            gameState: {
              ...state.gameState,
              priorityPlayer: event.priorityPlayer,
            },
          };
        });
        break;

      case "chain_resolved":
        set((state) => {
          if (!state.gameState) return state;
          return {
            gameState: {
              ...state.gameState,
              chainItems: [],
              priorityPlayer: null,
              waitingForResponse: false,
            },
          };
        });
        break;

      case "game_over":
        set((state) => {
          if (!state.gameState) return state;
          return {
            gameState: {
              ...state.gameState,
              status: "finished",
              winner: event.winner,
            },
          };
        });
        break;

      case "error":
        console.error("[store] game error:", event.message);
        break;
    }
  },
}));

// lobby store
interface LobbyStore {
  playerName: string;
  gameCode: string;
  error: string | null;

  setPlayerName: (name: string) => void;
  setGameCode: (code: string) => void;
  setError: (error: string | null) => void;
}

export const useLobbyStore = create<LobbyStore>((set) => ({
  playerName: "",
  gameCode: "",
  error: null,

  setPlayerName: (name) => set({ playerName: name }),
  setGameCode: (code) => set({ gameCode: code.toUpperCase() }),
  setError: (error) => set({ error }),
}));
