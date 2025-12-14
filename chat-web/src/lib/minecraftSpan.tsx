import React from "react";
import { MC_COLORS } from "src/lib/remarkMinecraftFormatting";
import { registerMessageMarkdownComponent } from "src/lib/messageMarkdownRegistry";

function ObfuscatedText({ text }: Readonly<{ text: string }>) {
  const [value, setValue] = useState(text);

  useEffect(() => {
    const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    const pick = (pool: string) =>
      pool[Math.trunc(Math.random() * pool.length)] ?? "";

    const id = setInterval(() => {
      let out = "";
      for (const ch of text) {
        if (/[A-Za-z]/.test(ch)) out += pick(letters);
        else if (/\d/.test(ch)) out += pick(digits);
        else out += ch;
      }
      setValue(out);
    }, 50);

    return () => clearInterval(id);
  }, [text]);

  return <span>{value}</span>;
}

export function MinecraftSpan(
  props: Readonly<
    Record<string, unknown> & {
      children?: React.ReactNode;
      color?: string;
      bold?: string;
      italic?: string;
      underline?: string;
      strike?: string;
      obfuscated?: string;
    }
  >
) {
  const { children, color, bold, italic, underline, strike, obfuscated } =
    props;

  const hex = color ? MC_COLORS[color.toLowerCase()] : undefined;
  const text =
    typeof children === "string"
      ? children
      : React.Children.toArray(children)
          .filter((c): c is string => typeof c === "string")
          .join("");

  return (
    <span
      className={classes(
        bold === "1" && "font-semibold",
        italic === "1" && "italic",
        underline === "1" && "underline",
        strike === "1" && "line-through"
      )}
      style={hex ? { color: hex } : undefined}
    >
      {obfuscated === "1" ? <ObfuscatedText text={text} /> : children}
    </span>
  );
}

// register once on import so sanitize + renderer both know about it
registerMessageMarkdownComponent("mc", MinecraftSpan, [
  "color",
  "bold",
  "italic",
  "underline",
  "strike",
  "obfuscated",
]);
