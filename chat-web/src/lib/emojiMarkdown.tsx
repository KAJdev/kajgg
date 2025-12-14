import React from "react";
import { DEFAULT_EMOJIS } from "src/lib/defaultEmojis";
import { registerMessageMarkdownComponent } from "src/lib/messageMarkdownRegistry";
import { getEmojiUrl } from "./cache";

function EmojiImage({ eid }: { eid: string }) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (failed) return;
    const img = new Image();
    img.onload = () => {
      setLoading(false);
    };
    img.onerror = () => {
      setLoading(false);
      setFailed(true);
    };
    img.src = getEmojiUrl(eid);
  }, [eid, failed]);

  if (loading) {
    return (
      <div className="w-4 h-4 inline-block bg-tertiary/50 animate-pulse" />
    );
  }

  if (failed) {
    return <span className="opacity-80">:{eid}:</span>;
  }

  return (
    <img
      src={getEmojiUrl(eid)}
      alt={`:${eid}:`}
      className="w-4 h-4 inline-block"
    />
  );
}

export function MarkdownEmoji(
  props: Readonly<
    Record<string, unknown> & {
      eid?: string;
      ename?: string;
      children?: React.ReactNode;
    }
  >
) {
  const eid = typeof props.eid === "string" ? props.eid : undefined;
  const ename = typeof props.ename === "string" ? props.ename : undefined;

  if (eid) {
    return <EmojiImage eid={eid} />;
  }

  if (ename) {
    const key = ename.toLowerCase();
    const builtin = DEFAULT_EMOJIS[key as keyof typeof DEFAULT_EMOJIS];
    if (builtin) {
      return <span className="text-2xl w-4 h-4 inline-block">{builtin}</span>;
    }
    return <span className="opacity-80">{`:${ename}:`}</span>;
  }

  return <span className="opacity-80">:emoji:</span>;
}

// register once on import so sanitize + renderer both know about it
registerMessageMarkdownComponent("emoji", MarkdownEmoji, ["eid", "ename"]);
