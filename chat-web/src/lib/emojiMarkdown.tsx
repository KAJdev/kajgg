import React from "react";
import { DEFAULT_EMOJIS } from "src/lib/defaultEmojis";
import { registerMessageMarkdownComponent } from "src/lib/messageMarkdownRegistry";

export function MarkdownEmoji(
  props: Readonly<
    Record<string, unknown> & {
      id?: string;
      name?: string;
      children?: React.ReactNode;
    }
  >
) {
  const id = typeof props.id === "string" ? props.id : undefined;
  const name = typeof props.name === "string" ? props.name : undefined;

  if (id) {
    // id-only url so markdown parsing can stay dumb/simple
    return (
      <img
        src={`https://cdn.kaj.gg/emojis/${id}`}
        alt={`:${id}:`}
        className="w-4 h-4 inline-block align-[-2px]"
        loading="lazy"
      />
    );
  }

  if (name) {
    const key = name.toLowerCase();
    const builtin = DEFAULT_EMOJIS[key as keyof typeof DEFAULT_EMOJIS];
    if (builtin) {
      return <span className="text-2xl w-4 h-4 inline-block">{builtin}</span>;
    }
    return <span className="opacity-80">{`:${name}:`}</span>;
  }

  return <span className="opacity-80">:emoji:</span>;
}

// register once on import so sanitize + renderer both know about it
registerMessageMarkdownComponent("emoji", MarkdownEmoji, ["id", "name"]);
