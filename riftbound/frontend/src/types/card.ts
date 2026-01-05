export type CardRarity = "common" | "uncommon" | "rare" | "epic";
export type CardType = "unit" | "spell" | "gear" | "rune" | "battlefield" | "champion";
export type CardOrientation = "portrait" | "landscape";

export interface Card {
  id: string;
  title: string;
  type?: CardType;
  superType?: string;  // champion, legend, etc
  rarity: CardRarity;
  set: string;
  number: number;
  orientation?: CardOrientation;
  tags?: string[];
  
  // stats (for units)
  attack?: number;
  health?: number;
  
  // flavor
  description?: string;
  flavorText?: string;

  // rules text (from dataset)
  text?: string;

  // cost data (from dataset)
  energy?: number;
  power?: number;
  might?: number;
  color?: string;
}
