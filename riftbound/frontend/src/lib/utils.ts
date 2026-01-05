import type { GamePhase } from "@/types";

/**
 * cn utility for classnames
 */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * format currency with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * sleep for a given number of ms
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * generate a unique id
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * clamp a number between min and max
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/**
 * format game phase for display
 */
export function formatPhase(phase: GamePhase): string {
  const phases: Record<GamePhase, string> = {
    ready: "Ready",
    score: "Score",
    draw: "Draw",
    channel: "Channel",
    main: "Main",
    end: "End",
  };
  return phases[phase] ?? phase;
}

/**
 * format card image url from piltover archive cdn
 */
export function getCardImageUrl(setCode: string, cardNumber: number): string {
  // piltover archive riftbound cdn format: {SET}-{NNN}.webp
  return `https://cdn.piltoverarchive.com/cards/${setCode}-${String(cardNumber).padStart(3, "0")}.webp?width=480`;
}
