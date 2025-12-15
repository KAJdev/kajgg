import React from "react";
import { registerMessageMarkdownComponent } from "src/lib/messageMarkdownRegistry";
import { useAuthor, useUser } from "src/lib/cache";
import { fetchAuthor } from "src/lib/api";
import { Popover } from "react-tiny-popover";
import { AuthorPlate } from "src/components/AuthorPlate";
import { getColor } from "./utils";

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
  const self = useUser();
  const mentionedMe = !!self?.id && uid === self.id;

  const [isOpen, setIsOpen] = useState(false);

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

  const content = (
    <span
      className={classes(
        "inline-flex items-center gap-0.5 px-1 cursor-pointer",
        mentionedMe
          ? "bg-primary font-bold text-background hover:bg-primary/80"
          : "bg-tertiary/30 hover:bg-secondary/50 text-[var(--color-username)]",
        isOpen && (mentionedMe ? "bg-primary/80" : "bg-secondary/50")
      )}
      style={
        {
          ["--color-username"]: author.color ?? getColor(author.id),
        } as React.CSSProperties
      }
      onClick={() => setIsOpen(true)}
    >
      <span className="opacity-80">@{uname}</span>
    </span>
  );

  return (
    <Popover
      onClickOutside={() => setIsOpen(false)}
      content={<AuthorPlate author={author} />}
      positions={["left", "right"]}
      isOpen={isOpen}
      align="start"
      padding={10}
    >
      {content}
    </Popover>
  );
}

// register once on import so sanitize + renderer both know about it
registerMessageMarkdownComponent("mention", MarkdownMention, ["uid", "uname"]);
