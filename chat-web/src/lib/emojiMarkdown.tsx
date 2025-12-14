import React from "react";
import { getDefaultEmojiByName } from "src/lib/defaultEmojiIndex";
import { registerMessageMarkdownComponent } from "src/lib/messageMarkdownRegistry";
import { MessageMarkdownContext } from "src/lib/messageMarkdownContext";
import { getEmojiUrl } from "./cache";

function EmojiImage({
  eid,
  className,
}: Readonly<{ eid: string; className?: string }>) {
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
      <div
        className={classes(
          "inline-block bg-tertiary/50 animate-pulse",
          className
        )}
      />
    );
  }

  if (failed) {
    return <span className="opacity-80">:{eid}:</span>;
  }

  return (
    <img
      src={getEmojiUrl(eid)}
      alt={`:${eid}:`}
      className={classes("inline-block", className)}
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
  const { emojiOnly } = useContext(MessageMarkdownContext);

  if (eid) {
    return (
      <span className="inline-flex align-[-2px]">
        <EmojiImage eid={eid} className={emojiOnly ? "w-12 h-12" : "w-4 h-4"} />
      </span>
    );
  }

  if (ename) {
    const key = ename.toLowerCase();
    const builtin = getDefaultEmojiByName(key);
    if (builtin) {
      return (
        <span
          className={classes(
            "inline-block w-4 h-4",
            emojiOnly ? "text-6xl" : "text-2xl"
          )}
        >
          {builtin}
        </span>
      );
    }
    return <span className="opacity-80">{`:${ename}:`}</span>;
  }

  return <span className="opacity-80">:emoji:</span>;
}

// register once on import so sanitize + renderer both know about it
registerMessageMarkdownComponent("emoji", MarkdownEmoji, ["eid", "ename"]);
