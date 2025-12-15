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

function tokenToHtml(uid: string, uname: string) {
  return `<mention uid="${escapeHtml(uid)}" uname="${escapeHtml(
    uname
  )}"></mention>`;
}

function isValidUsernameToken(token: string) {
  return /^[a-zA-Z0-9_-]{1,32}$/.test(token);
}

function parseMentionNodes(
  text: string,
  usernameToId: Record<string, string>
): MdastNode[] | null {
  if (!text) return null;

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

    // escape: \@name => literal @name
    if (ch === "\\" && text[i + 1] === "@") {
      buf += "@";
      i += 2;
      continue;
    }

    if (ch === "@") {
      // don't treat emails like a@b.com as mentions
      const prev = i > 0 ? text[i - 1] : "";
      if (prev && /[a-zA-Z0-9_-]/.test(prev)) {
        buf += "@";
        i += 1;
        continue;
      }

      let j = i + 1;
      while (j < text.length && /[a-zA-Z0-9_-]/.test(text[j] ?? "")) j += 1;
      const token = j > i + 1 ? text.slice(i + 1, j) : "";

      if (token && isValidUsernameToken(token)) {
        const uid = usernameToId[token] ?? usernameToId[token.toLowerCase()];
        if (uid) {
          flush();
          out.push({ type: "html", value: tokenToHtml(uid, token) });
          didReplace = true;
          i = j;
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

function transformTextNodes(
  tree: MdastNode,
  usernameToId: Record<string, string>
) {
  const walk = (node: MdastNode) => {
    // don't touch code blocks / inline code
    if (node.type === "code" || node.type === "inlineCode") return;

    if (Array.isArray(node.children)) {
      let idx = 0;
      while (idx < node.children.length) {
        const child = node.children[idx];

        if (child.type === "text" && typeof child.value === "string") {
          const replacement = parseMentionNodes(child.value, usernameToId);
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

export const remarkMentions: Plugin<
  [
    {
      usernameToId: Record<string, string>;
    }
  ]
> = (opts) => {
  const usernameToId = opts?.usernameToId ?? {};
  return (tree: unknown) => {
    if (!tree || typeof tree !== "object") return;
    if (!usernameToId || Object.keys(usernameToId).length === 0) return;
    transformTextNodes(tree as MdastNode, usernameToId);
  };
};
