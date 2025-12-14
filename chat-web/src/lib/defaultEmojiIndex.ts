import emojiData from "emojibase-data/en/compact.json";
import shortcodesData from "emojibase-data/en/shortcodes/emojibase.json";

type EmojiEntry = {
  label?: string;
  hexcode: string;
  unicode: string;
  tags?: string[];
};

const EMOJIS = emojiData as unknown as EmojiEntry[];
const SHORTCODES = shortcodesData as unknown as Record<
  string,
  string | string[]
>;

const unicodeByHex = new Map<string, string>();
const metaByHex = new Map<string, { label?: string; tags?: string[] }>();

for (const e of EMOJIS) {
  const hex = e.hexcode?.toUpperCase();
  if (!hex) continue;
  unicodeByHex.set(hex, e.unicode);
  metaByHex.set(hex, { label: e.label, tags: e.tags });
}

const byShortcode = new Map<string, string>();

for (const [hexRaw, scsRaw] of Object.entries(SHORTCODES)) {
  const hex = hexRaw.toUpperCase();
  const unicode = unicodeByHex.get(hex);
  if (!unicode) continue;

  const scs = Array.isArray(scsRaw) ? scsRaw : [scsRaw];
  for (const sc of scs) {
    if (!sc) continue;
    byShortcode.set(sc.toLowerCase(), unicode);
  }
}

export function getDefaultEmojiByName(name: string): string | null {
  return byShortcode.get(name.toLowerCase()) ?? null;
}

function normalizeShortcodes(scsRaw: string | string[]) {
  return (Array.isArray(scsRaw) ? scsRaw : [scsRaw]).map((s) =>
    s.toLowerCase()
  );
}

export function searchDefaultEmojis(query: string, limit = 10) {
  const q = query.toLowerCase();
  if (!q) return [];

  // linear scan is fine here (~3-4k entries) and keeps bundle small/simple
  const out: Array<{ name: string; emoji: string }> = [];
  const seen = new Set<string>();

  for (const [hexRaw, scsRaw] of Object.entries(SHORTCODES)) {
    if (out.length >= limit) break;

    const hex = hexRaw.toUpperCase();
    const unicode = unicodeByHex.get(hex);
    if (!unicode) continue;

    const shortcodes = normalizeShortcodes(scsRaw);
    const meta = metaByHex.get(hex);
    const tags = (meta?.tags ?? []).map((s) => s.toLowerCase());
    const label = (meta?.label ?? "").toLowerCase();

    const hit =
      shortcodes.some((s) => s.includes(q)) ||
      tags.some((s) => s.includes(q)) ||
      (label ? label.includes(q) : false);
    if (!hit) continue;

    const name = shortcodes.find((s) => s.includes(q)) ?? shortcodes[0] ?? "";
    if (!name) continue;

    // don't spam dupes from multiple aliases
    const key = `${name}:${unicode}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ name, emoji: unicode });
  }

  return out;
}
