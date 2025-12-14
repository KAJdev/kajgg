import { useMemo } from "react";
import type { Emoji as EmojiType } from "@schemas/index";
import { searchEmojis } from "src/lib/cache";
import { DEFAULT_EMOJIS } from "src/lib/defaultEmojis";
import { Emoji } from "./Emoji";
import { useKeybind } from "src/lib/keybind";

export function EmojiSearch({
  query,
  onPick,
}: Readonly<{
  query: string;
  onPick: (emoji: string) => void;
}>) {
  const [hoveredEmojiIndex, setHoveredEmojiIndex] = useState<number | null>(
    null
  );

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
    else setHoveredEmojiIndex(hoveredEmojiIndex - 1);
  });

  useKeybind("arrowdown", () => {
    if (hoveredEmojiIndex === null) setHoveredEmojiIndex(0);
    else setHoveredEmojiIndex(hoveredEmojiIndex + 1);
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
    else setHoveredEmojiIndex(hoveredEmojiIndex + 1);
  });

  return (
    <div className="bg-tertiary p-2 text-primary w-full flex flex-col gap-2">
      <p>emojis</p>
      {results.map((result) => (
        <div
          key={result.name}
          onClick={() => {
            if (DEFAULT_EMOJIS[result.name as keyof typeof DEFAULT_EMOJIS]) {
              onPick(result.emoji as string);
            } else {
              onPick(`:${(result.emoji as EmojiType).id}:`);
            }
          }}
          className="flex items-center gap-2 hover:bg-secondary cursor-pointer"
        >
          <Emoji emoji={result.emoji} />:{result.name}:
        </div>
      ))}
    </div>
  );
}
