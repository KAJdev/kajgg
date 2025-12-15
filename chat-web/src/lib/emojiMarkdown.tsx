import React from "react";
import { getDefaultEmojiByName } from "src/lib/defaultEmojiIndex";
import { registerMessageMarkdownComponent } from "src/lib/messageMarkdownRegistry";
import { getEmojiUrl } from "./cache";

function EmojiImage({ eid }: Readonly<{ eid: string }>) {
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
      <div className="custom-emoji bg-tertiary/50 animate-pulse w-5.5 h-5.5" />
    );
  }

  if (failed) {
    return <span className="opacity-80">:{eid}:</span>;
  }

  return (
    <img src={getEmojiUrl(eid)} alt={`:${eid}:`} className="custom-emoji" />
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
    const builtin = getDefaultEmojiByName(key);
    if (builtin) {
      // twemoji will replace this unicode with an <img class="twemoji" ...>
      return <span>{builtin}</span>;
    }
    return <span className="opacity-80">{`:${ename}:`}</span>;
  }

  return <span className="opacity-80">:emoji:</span>;
}

// register once on import so sanitize + renderer both know about it
registerMessageMarkdownComponent("emoji", MarkdownEmoji, ["eid", "ename"]);
