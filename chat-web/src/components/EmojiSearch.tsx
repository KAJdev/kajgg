import { useMemo } from "react";
import type { Emoji as EmojiType } from "@schemas/index";
import { searchEmojis } from "src/lib/cache";
import { DEFAULT_EMOJIS } from "src/lib/defaultEmojis";
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
      emoji,
    }));
    const defaultEmojis = Object.entries(DEFAULT_EMOJIS)
      .filter(([name]) => name.includes(query))
      .map(([name, emoji]) => ({
        name,
        emoji,
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
    onPick(results[hoveredEmojiIndex].emoji as string);
  });

  useKeybind("escape", () => {
    onPick("");
  });

  useKeybind("tab", () => {
    if (hoveredEmojiIndex === null) setHoveredEmojiIndex(0);
    else setHoveredEmojiIndex((hoveredEmojiIndex + 1) % results.length);
  });

  return (
    <div className="bg-tertiary text-primary w-full flex flex-col">
      <Label className="p-2">emojis matching :{query}:</Label>
      {results.map((result, index) => (
        <div
          key={result.name}
          onClick={() => {
            if (DEFAULT_EMOJIS[result.name as keyof typeof DEFAULT_EMOJIS]) {
              onPick(result.emoji as string);
            } else {
              onPick(`:${(result.emoji as EmojiType).id}:`);
            }
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
