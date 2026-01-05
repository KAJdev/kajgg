import type { Card, GameState, Deck } from "@/types";

const API_BASE = "/api";

// helper for fetch with error handling
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "request failed" }));
    throw new Error(error.message || `http error ${response.status}`);
  }

  return response.json();
}

// card api
export async function fetchCards(): Promise<Card[]> {
  return request<Card[]>("/cards");
}

export async function fetchCard(cardId: string): Promise<Card> {
  return request<Card>(`/cards/${cardId}`);
}

export async function searchCards(query: string): Promise<Card[]> {
  return request<Card[]>(`/cards/search?q=${encodeURIComponent(query)}`);
}

// game api
export async function createGame(
  playerName: string,
  deck: Deck
): Promise<{ gameId: string; code: string; playerId: string }> {
  return request("/games", {
    method: "POST",
    body: JSON.stringify({ playerName, deck }),
  });
}

export async function joinGame(
  code: string,
  playerName: string,
  deck: Deck
): Promise<{ gameId: string; playerId: string }> {
  return request(`/games/join`, {
    method: "POST",
    body: JSON.stringify({ code, playerName, deck }),
  });
}

export async function getGameState(gameId: string): Promise<GameState> {
  return request<GameState>(`/games/${gameId}`);
}

// deck api
export async function saveDeck(deck: Deck): Promise<Deck> {
  return request("/decks", {
    method: "POST",
    body: JSON.stringify(deck),
  });
}

export async function getDecks(): Promise<Deck[]> {
  return request<Deck[]>("/decks");
}

export async function getDeck(deckId: string): Promise<Deck> {
  return request<Deck>(`/decks/${deckId}`);
}

export async function deleteDeck(deckId: string): Promise<void> {
  await request(`/decks/${deckId}`, { method: "DELETE" });
}

// validate deck format
export async function validateDeckImport(
  text: string
): Promise<{ valid: boolean; errors: string[]; deck?: Deck }> {
  return request("/decks/validate", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
