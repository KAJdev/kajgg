import { getDefaultEmojiByName } from "src/lib/defaultEmojiIndex";

const ZWJ = "\u200d";
const VS16 = "\ufe0f";
const VS15 = "\ufe0e";

const EMOJI_RUN_RE = /^[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}]+/u;
const HAS_PICTO_RE = /\p{Extended_Pictographic}/u;

function isNumericId(token: string) {
  return /^\d{1,64}$/.test(token);
}

function isUuid(token: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    token
  );
}

function isCuidLike(token: string) {
  // backend uses cuid2 with length 10 for ids
  return /^[a-z0-9]{10}$/i.test(token);
}

function isValidCustomEmojiId(token: string) {
  return isNumericId(token) || isUuid(token) || isCuidLike(token);
}

function isWhitespace(ch: string) {
  return ch === " " || ch === "\n" || ch === "\t" || ch === "\r";
}

export function isEmojiOnlyMessage(content: string) {
  const s = content.trim();
  if (!s) return false;

  const isEmojiToken = (token: string) =>
    isValidCustomEmojiId(token) || Boolean(getDefaultEmojiByName(token));

  const consumeEmojiToken = (from: number) => {
    if (s[from] !== ":") return null;
    const j = s.indexOf(":", from + 1);
    if (j === -1) return null;
    const token = s.slice(from + 1, j);
    if (!token) return null;
    if (!isEmojiToken(token)) return null;
    return { next: j + 1 };
  };

  const consumeUnicodeEmojiRun = (from: number) => {
    const rest = s.slice(from);
    const m = EMOJI_RUN_RE.exec(rest);
    if (!m) return null;
    const run = m[0] ?? "";
    if (!run || !HAS_PICTO_RE.test(run)) return null;
    let j = from + run.length;
    while (j < s.length) {
      const cj = s[j] ?? "";
      if (cj === ZWJ || cj === VS16 || cj === VS15) {
        j += 1;
        continue;
      }
      break;
    }
    return { next: j };
  };

  let i = 0;
  let sawAny = false;
  while (i < s.length) {
    const ch = s[i] ?? "";
    if (isWhitespace(ch)) {
      i += 1;
      continue;
    }

    const tok = consumeEmojiToken(i);
    if (tok) {
      sawAny = true;
      i = tok.next;
      continue;
    }

    const uni = consumeUnicodeEmojiRun(i);
    if (uni) {
      sawAny = true;
      i = uni.next;
      continue;
    }

    return false;
  }

  return sawAny;
}
