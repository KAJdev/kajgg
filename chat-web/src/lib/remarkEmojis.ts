import type { Plugin } from "unified";

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

function isValidToken(token: string) {
  // keep it simple: no spaces, no extra colons
  return /^[a-zA-Z0-9_-]{1,64}$/.test(token);
}

function tokenToHtml(token: string) {
  if (isNumericId(token) || isUuid(token) || isCuidLike(token)) {
    // don't use id/name attrs bc rehype-sanitize will clobber-prefix them ("user-content-...")
    return `<emoji eid="${escapeHtml(token)}"></emoji>`;
  }
  return `<emoji ename="${escapeHtml(token)}"></emoji>`;
}

function parseEmojiNodes(text: string): MdastNode[] | null {
  let didReplace = false;
  const out: MdastNode[] = [];
  let buf = "";

  const flush = () => {
    if (!buf) return;
    out.push({ type: "text", value: buf });
    buf = "";
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    // escape: \:name: => literal :name:
    if (ch === "\\" && text[i + 1] === ":") {
      buf += ":";
      i += 2;
      continue;
    }

    if (ch === ":") {
      const j = text.indexOf(":", i + 1);
      if (j !== -1) {
        const token = text.slice(i + 1, j);
        if (token && isValidToken(token)) {
          flush();
          out.push({ type: "html", value: tokenToHtml(token) });
          didReplace = true;
          i = j + 1;
          continue;
        }
      }
    }

    buf += ch;
    i += 1;
  }

  flush();
  return didReplace ? out : null;
}

function transformTextNodes(tree: MdastNode) {
  const walk = (node: MdastNode) => {
    // don't touch code blocks / inline code
    if (node.type === "code" || node.type === "inlineCode") return;

    if (Array.isArray(node.children)) {
      let idx = 0;
      while (idx < node.children.length) {
        const child = node.children[idx];

        if (child.type === "text" && typeof child.value === "string") {
          const replacement = parseEmojiNodes(child.value);
          if (!replacement) {
            idx += 1;
            continue;
          }

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

export const remarkEmojis: Plugin = () => {
  return (tree: unknown) => {
    if (!tree || typeof tree !== "object") return;
    transformTextNodes(tree as MdastNode);
  };
};
