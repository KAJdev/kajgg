import React from "react";
import { Emoji } from "src/components/Emoji";
import { DEFAULT_EMOJIS } from "src/lib/defaultEmojis";
import { useEmojis } from "src/lib/cache";
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
  const emojisByName = useEmojis();
  const id = typeof props.id === "string" ? props.id : undefined;
  const name = typeof props.name === "string" ? props.name : undefined;

  const resolved = React.useMemo(() => {
    if (id) {
      return Object.values(emojisByName).find((e) => e.id === id);
    }

    if (name) {
      const key = name.toLowerCase();
      const builtin = DEFAULT_EMOJIS[key as keyof typeof DEFAULT_EMOJIS];
      if (builtin) return builtin;
      return emojisByName[key];
    }

    return null;
  }, [emojisByName, id, name]);

  if (!resolved) {
    const fallback = id ? `:${id}:` : name ? `:${name}:` : ":emoji:";
    return <span className="opacity-80">{fallback}</span>;
  }

  return (
    <span className="inline-flex align-[-2px]">
      <Emoji emoji={resolved} />
    </span>
  );
}

// register once on import so sanitize + renderer both know about it
registerMessageMarkdownComponent("emoji", MarkdownEmoji, ["id", "name"]);


