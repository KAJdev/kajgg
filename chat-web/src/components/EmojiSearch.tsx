import { useMemo } from "react";
import type { Emoji as EmojiType } from "@schemas/index";
import { searchEmojis } from "src/lib/cache";
import { searchDefaultEmojis } from "src/lib/defaultEmojiIndex";
import { Emoji } from "./Emoji";
import { useKeybind } from "src/lib/keybind";
import { Label } from "@theme/Label";

export function EmojiSearch({
  query,
  onPick,
}: Readonly<{
  query: string;
  onPick: (emoji: string) => void;
}>) {
  const [hoveredEmojiIndex, setHoveredEmojiIndex] = useState<number | null>(0);

  const results = useMemo(() => {
    const customEmojis = searchEmojis(query).map((emoji) => ({
      name: emoji.name,
      type: "custom",
      emoji,
    }));
    const defaultEmojis = searchDefaultEmojis(query, 10).map((r) => ({
      name: r.name,
      type: "default",
      emoji: r.emoji,
    }));
    return [...customEmojis, ...defaultEmojis].slice(0, 10);
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (results.length > 0) setHoveredEmojiIndex(0);
  }, [results]);

  useKeybind("arrowup", () => {
    if (hoveredEmojiIndex === null) setHoveredEmojiIndex(0);
    else
      setHoveredEmojiIndex(
        (hoveredEmojiIndex - 1 + results.length) % results.length
      );
  });

  useKeybind("arrowdown", () => {
    if (hoveredEmojiIndex === null) setHoveredEmojiIndex(0);
    else setHoveredEmojiIndex((hoveredEmojiIndex + 1) % results.length);
  });

  useKeybind("enter", () => {
    if (hoveredEmojiIndex === null) return;
    const result = results[hoveredEmojiIndex];
    if (result.type === "default") onPick(result.emoji as string);
    else onPick(`:${(result.emoji as EmojiType).id}:`);
  });

  useKeybind("escape", () => {
    onPick(`:${query}`);
  });

  useKeybind("tab", () => {
    if (hoveredEmojiIndex === null) return;
    const result = results[hoveredEmojiIndex];
    if (result.type === "default") onPick(result.emoji as string);
    else onPick(`:${(result.emoji as EmojiType).id}:`);
  });

  return (
    <div className="bg-tertiary text-primary w-full flex flex-col">
      <Label className="p-2">emojis matching :{query}:</Label>
      {results.map((result, index) => (
        <div
          key={result.name + result.type}
          onClick={() => {
            if (typeof result.emoji === "string") onPick(result.emoji);
            else onPick(`:${(result.emoji as EmojiType).id}:`);
          }}
          onMouseEnter={() => {
            setHoveredEmojiIndex(index);
          }}
          className={classes(
            "flex items-center gap-2 hover:bg-secondary/25 cursor-pointer p-2",
            hoveredEmojiIndex === index && "bg-secondary/25"
          )}
        >
          <Emoji emoji={result.emoji} />:{result.name}:
        </div>
      ))}
    </div>
  );
}
