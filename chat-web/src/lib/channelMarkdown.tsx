import React from "react";
import { Link } from "react-router";
import { registerMessageMarkdownComponent } from "src/lib/messageMarkdownRegistry";

export function MarkdownChannel(
  props: Readonly<
    Record<string, unknown> & {
      cid?: string;
      cname?: string;
      children?: React.ReactNode;
    }
  >
) {
  const cid = typeof props.cid === "string" ? props.cid : undefined;
  const cname = typeof props.cname === "string" ? props.cname : undefined;

  if (!cid || !cname) {
    return <span className="opacity-80">#channel</span>;
  }

  return (
    <Link
      to={`/channels/${cid}`}
      className="inline-flex items-center gap-0.5 bg-tertiary/30 px-1 hover:bg-secondary/50"
    >
      <span className="opacity-80">#</span>
      <span>{cname}</span>
    </Link>
  );
}

// register once on import so sanitize + renderer both know about it
registerMessageMarkdownComponent("channel", MarkdownChannel, ["cid", "cname"]);
