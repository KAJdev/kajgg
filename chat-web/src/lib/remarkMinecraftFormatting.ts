import type { Plugin } from "unified";

type McState = {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  obfuscated?: boolean;
};

type Segment = { text: string; state: McState };

export const MC_COLORS: Readonly<Record<string, string>> = {
  // classic minecraft colors
  "0": "#000000",
  "1": "#0000aa",
  "2": "#00aa00",
  "3": "#00aaaa",
  "4": "#aa0000",
  "5": "#aa00aa",
  "6": "#ffaa00",
  "7": "#aaaaaa",
  "8": "#555555",
  "9": "#5555ff",
  a: "#55ff55",
  b: "#55ffff",
  c: "#ff5555",
  d: "#ff55ff",
  e: "#ffff55",
  f: "#ffffff",
};

type MdastNode = {
  type: string;
  value?: unknown;
  children?: MdastNode[];
};

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isColorCode(code: string) {
  const c = code.toLowerCase();
  return c in MC_COLORS;
}

function hasAnyStyle(state: McState) {
  return Boolean(
    state.color ||
      state.bold ||
      state.italic ||
      state.underline ||
      state.strike ||
      state.obfuscated
  );
}

function applyCode(prev: McState, codeRaw: string): McState {
  const code = codeRaw.toLowerCase();

  if (code === "r") {
    return {};
  }

  if (isColorCode(code)) {
    // mc colors reset formatting too
    return { color: code };
  }

  if (code === "k") return { ...prev, obfuscated: true };
  if (code === "l") return { ...prev, bold: true };
  if (code === "m") return { ...prev, strike: true };
  if (code === "n") return { ...prev, underline: true };
  if (code === "o") return { ...prev, italic: true };

  return prev;
}

function parseMinecraftSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let state: McState = {};
  let buf = "";

  const flush = () => {
    if (!buf) return;
    segments.push({ text: buf, state });
    buf = "";
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;

    // escape: \&x => literal &x
    if (ch === "\\" && text[i + 1] === "&") {
      buf += "&";
      i += 2;
      continue;
    }

    if (ch === "&" && i + 1 < text.length) {
      const code = text[i + 1]!;
      const lower = code.toLowerCase();
      const recognized =
        lower === "r" ||
        lower === "k" ||
        lower === "l" ||
        lower === "m" ||
        lower === "n" ||
        lower === "o" ||
        isColorCode(lower);

      if (recognized) {
        flush();
        state = applyCode(state, lower);
        i += 2;
        continue;
      }
    }

    buf += ch;
    i += 1;
  }

  flush();
  return segments;
}

function stateToAttrs(state: McState) {
  const attrs: Record<string, string> = {};

  if (state.color) attrs.color = state.color;
  if (state.bold) attrs.bold = "1";
  if (state.italic) attrs.italic = "1";
  if (state.underline) attrs.underline = "1";
  if (state.strike) attrs.strike = "1";
  if (state.obfuscated) attrs.obfuscated = "1";

  return attrs;
}

function attrsToString(attrs: Record<string, string>) {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    parts.push(`${k}="${escapeHtml(v)}"`);
  }
  return parts.length ? " " + parts.join(" ") : "";
}

function segmentToNodes(seg: Segment) {
  const attrs = stateToAttrs(seg.state);
  const hasStyle = Object.keys(attrs).length > 0;

  if (!hasStyle) {
    return [{ type: "text", value: seg.text }];
  }

  const html = `<mc${attrsToString(attrs)}>${escapeHtml(seg.text)}</mc>`;
  return [{ type: "html", value: html }];
}

function transformTextNodes(tree: MdastNode) {
  const walk = (node: MdastNode) => {
    // don't touch code blocks / inline code
    if (node.type === "code" || node.type === "inlineCode") return;

    if (Array.isArray(node.children)) {
      let idx = 0;
      while (idx < node.children.length) {
        const child = node.children[idx]!;

        if (child.type === "text" && typeof child.value === "string") {
          const segs = parseMinecraftSegments(child.value);
          if (segs.length === 1 && !hasAnyStyle(segs[0]!.state)) {
            idx += 1;
            continue;
          }

          const replacement = segs.flatMap((s) =>
            segmentToNodes(s)
          ) as MdastNode[];
          node.children.splice(idx, 1, ...replacement);
          idx += replacement.length;
          continue;
        }

        walk(child);
        idx += 1;
      }
    }
  };

  walk(tree);
}

export const remarkMinecraftFormatting: Plugin = () => {
  return (tree: unknown) => {
    if (!tree || typeof tree !== "object") return;
    transformTextNodes(tree as MdastNode);
  };
};
