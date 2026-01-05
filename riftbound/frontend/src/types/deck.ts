import type { Card } from "./card";

export interface DeckEntry {
  cardId: string;
  count: number;
  card?: Card; // populated when deck is loaded
}

export interface Deck {
  id: string;
  name: string;
  // piltover archive format sections
  legend?: DeckEntry | null;
  champion?: DeckEntry | null;
  battlefields?: DeckEntry[];
  sideboard?: DeckEntry[];
  mainDeck: DeckEntry[]; // 40 cards
  runeDeck: DeckEntry[]; // 12 cards
  createdAt: string;
  updatedAt: string;
}

// deck building rules
export const MAIN_DECK_SIZE = 40;
export const RUNE_DECK_SIZE = 12;
export const BATTLEFIELD_COUNT = 3;
export const MAX_COPIES_PER_CARD = 3;
export const MAX_COPIES_CHAMPION = 1;
export const MAX_COPIES_LEGEND = 1;
export const MAX_COPIES_BATTLEFIELD = 1;

export interface DeckValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateDeck(deck: Deck): DeckValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // check main deck size
  const mainDeckCount = deck.mainDeck.reduce((sum, entry) => sum + entry.count, 0);
  const championCount = deck.champion?.count ?? 0;
  const effectiveMainCount = mainDeckCount === MAIN_DECK_SIZE ? MAIN_DECK_SIZE : mainDeckCount + championCount;
  if (effectiveMainCount !== MAIN_DECK_SIZE) {
    errors.push(`main deck must have exactly ${MAIN_DECK_SIZE} cards (has ${mainDeckCount}${championCount ? ` + champion ${championCount}` : ""})`);
  }

  // check rune deck size
  const runeDeckCount = deck.runeDeck.reduce((sum, entry) => sum + entry.count, 0);
  if (runeDeckCount !== RUNE_DECK_SIZE) {
    errors.push(`rune deck must have exactly ${RUNE_DECK_SIZE} cards (has ${runeDeckCount})`);
  }

  // check legend
  if (!deck.legend || deck.legend.count !== 1) {
    errors.push(`legend must have exactly 1 card`);
  }

  // check battlefields
  const battlefields = deck.battlefields ?? [];
  if (battlefields.length !== BATTLEFIELD_COUNT) {
    errors.push(`battlefields must have exactly ${BATTLEFIELD_COUNT} cards (has ${battlefields.length})`);
  }
  const battlefieldNames = new Set(battlefields.map((b) => b.cardId.toLowerCase().trim()));
  if (battlefieldNames.size !== battlefields.length) {
    errors.push(`battlefields must be unique`);
  }

  // check card copy limits
  const allEntries: DeckEntry[] = [
    ...deck.mainDeck,
    ...deck.runeDeck,
    ...(deck.legend ? [deck.legend] : []),
    ...(deck.champion ? [deck.champion] : []),
    ...(deck.battlefields ?? []),
    ...(deck.sideboard ?? []),
  ];

  for (const entry of allEntries) {
    const isChampion = entry.card?.superType === "champion";
    const isLegend = entry.card?.type === "legend" || entry.card?.superType === "legend";
    const isBattlefield = entry.card?.type === "battlefield";
    const maxCopies = isBattlefield
      ? MAX_COPIES_BATTLEFIELD
      : isLegend
        ? MAX_COPIES_LEGEND
        : isChampion
          ? MAX_COPIES_CHAMPION
          : MAX_COPIES_PER_CARD;
    
    if (entry.count > maxCopies) {
      errors.push(`${entry.card?.title || entry.cardId}: max ${maxCopies} copies allowed (has ${entry.count})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// parse deck list from text
export function parseDeckList(text: string): {
  legend: DeckEntry | null;
  champion: DeckEntry | null;
  battlefields: DeckEntry[];
  mainDeck: DeckEntry[];
  runeDeck: DeckEntry[];
  sideboard: DeckEntry[];
} {
  const lines = text.trim().split("\n");

  let legend: DeckEntry | null = null;
  let champion: DeckEntry | null = null;
  const battlefields: DeckEntry[] = [];
  const mainDeck: DeckEntry[] = [];
  const runeDeck: DeckEntry[] = [];
  const sideboard: DeckEntry[] = [];

  type Section = "legend" | "champion" | "mainDeck" | "battlefields" | "runes" | "sideboard" | "unknown";
  let section: Section = "unknown";

  const setSection = (raw: string) => {
    const key = raw.toLowerCase().replace(/[^a-z]/g, "");
    if (key === "legend") section = "legend";
    else if (key === "champion") section = "champion";
    else if (key === "maindeck") section = "mainDeck";
    else if (key === "battlefields") section = "battlefields";
    else if (key === "runes") section = "runes";
    else if (key === "sideboard") section = "sideboard";
    else section = "unknown";
  };

  const pushEntry = (dest: DeckEntry[], entry: DeckEntry) => {
    const existing = dest.find((e) => e.cardId.toLowerCase() === entry.cardId.toLowerCase());
    if (existing) existing.count += entry.count;
    else dest.push(entry);
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

    // section headers like "MainDeck:"
    const header = trimmed.match(/^([a-zA-Z]+)\s*:\s*$/);
    if (header) {
      setSection(header[1]);
      continue;
    }

    // entry lines like "3 Arcane Shift" or "3x Arcane Shift"
    const match = trimmed.match(/^(\d+)\s*x?\s+(.+?)\s*$/);
    if (!match) continue;

    const count = Number.parseInt(match[1], 10) || 1;
    const name = match[2].trim();
    const entry: DeckEntry = { cardId: name, count };

    if (section === "legend") legend = entry;
    else if (section === "champion") champion = entry;
    else if (section === "battlefields") pushEntry(battlefields, entry);
    else if (section === "runes") pushEntry(runeDeck, entry);
    else if (section === "sideboard") pushEntry(sideboard, entry);
    else pushEntry(mainDeck, entry);
  }

  // fallback for old formats without headers: assume everything is main unless we see a rune hint
  if (!legend && battlefields.length === 0 && runeDeck.length === 0 && champion === null) {
    // try old parsing with "rune" keyword lines
    let current: "main" | "rune" = "main";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
      if (trimmed.toLowerCase().includes("rune")) {
        current = "rune";
        continue;
      }
      const m = trimmed.match(/^(\d+)x?\s+(.+)$/) || trimmed.match(/^(.+?)\s*x(\d+)$/);
      if (!m) continue;
      const c = Number.parseInt(m[1], 10) || Number.parseInt(m[2], 10) || 1;
      const id = (m[2] || m[1]).trim();
      const e: DeckEntry = { cardId: id, count: c };
      if (current === "rune") pushEntry(runeDeck, e);
      else pushEntry(mainDeck, e);
    }
  }

  return { legend, champion, battlefields, mainDeck, runeDeck, sideboard };
}

export function exportDeckList(deck: Deck): string {
  let output = `# ${deck.name}\n\n`;
  output += "# Main Deck\n";
  
  for (const entry of deck.mainDeck) {
    const name = entry.card?.title || entry.cardId;
    output += `${entry.count}x ${name}\n`;
  }
  
  output += "\n# Rune Deck\n";
  
  for (const entry of deck.runeDeck) {
    const name = entry.card?.title || entry.cardId;
    output += `${entry.count}x ${name}\n`;
  }
  
  return output;
}

