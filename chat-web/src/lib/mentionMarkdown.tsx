import React from "react";
import { registerMessageMarkdownComponent } from "src/lib/messageMarkdownRegistry";
import { useAuthor } from "src/lib/cache";
import { fetchAuthor } from "src/lib/api";
import { Username } from "src/components/Username";

export function MarkdownMention(
  props: Readonly<
    Record<string, unknown> & {
      uid?: string;
      uname?: string;
      children?: React.ReactNode;
    }
  >
) {
  const uid = typeof props.uid === "string" ? props.uid : undefined;
  const uname = typeof props.uname === "string" ? props.uname : undefined;
  const author = useAuthor(uid ?? "");

  useEffect(() => {
    if (!uid) return;
    if (author) return;
    fetchAuthor(uid).catch(() => null);
  }, [uid, author]);

  if (!uid) {
    return <span className="opacity-80">@{uname ?? "user"}</span>;
  }

  if (!author) {
    return <span className="opacity-80">@{uname ?? "user"}</span>;
  }

  return (
    <span className="inline-flex items-center gap-0.5 bg-tertiary/30 px-1 rounded-sm">
      <span className="opacity-80">@</span>
      <Username author={author} />
    </span>
  );
}

// register once on import so sanitize + renderer both know about it
registerMessageMarkdownComponent("mention", MarkdownMention, ["uid", "uname"]);
