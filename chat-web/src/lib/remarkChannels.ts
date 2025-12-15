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

function tokenToHtml(cid: string, cname: string) {
  return `<channel cid="${escapeHtml(cid)}" cname="${escapeHtml(
    cname
  )}"></channel>`;
}

function isValidChannelToken(token: string) {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(token);
}

function parseChannelNodes(
  text: string,
  channelNameToId: Record<string, string>
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

    // escape: \#name => literal #name
    if (ch === "\\" && text[i + 1] === "#") {
      buf += "#";
      i += 2;
      continue;
    }

    if (ch === "#") {
      // headings are "# " not "#name", so we're safe, but avoid hashtags in the middle of words
      const prev = i > 0 ? text[i - 1] : "";
      if (prev && /[a-zA-Z0-9_-]/.test(prev)) {
        buf += "#";
        i += 1;
        continue;
      }

      let j = i + 1;
      while (j < text.length && /[a-zA-Z0-9_-]/.test(text[j] ?? "")) j += 1;
      const token = j > i + 1 ? text.slice(i + 1, j) : "";

      if (token && isValidChannelToken(token)) {
        const cid =
          channelNameToId[token] ?? channelNameToId[token.toLowerCase()];
        if (cid) {
          flush();
          out.push({ type: "html", value: tokenToHtml(cid, token) });
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
  channelNameToId: Record<string, string>
) {
  const walk = (node: MdastNode) => {
    if (node.type === "code" || node.type === "inlineCode") return;

    if (Array.isArray(node.children)) {
      let idx = 0;
      while (idx < node.children.length) {
        const child = node.children[idx];

        if (child.type === "text" && typeof child.value === "string") {
          const replacement = parseChannelNodes(child.value, channelNameToId);
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

export const remarkChannels: Plugin<
  [
    {
      channelNameToId: Record<string, string>;
    }
  ]
> = (opts) => {
  const channelNameToId = opts?.channelNameToId ?? {};
  return (tree: unknown) => {
    if (!tree || typeof tree !== "object") return;
    if (!channelNameToId || Object.keys(channelNameToId).length === 0) return;
    transformTextNodes(tree as MdastNode, channelNameToId);
  };
};
