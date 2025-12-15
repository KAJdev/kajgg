import type { Author } from "@schemas/models/author";
import { Label } from "@theme/Label";
import { useMemo } from "react";
import { useAuthors } from "src/lib/cache";
import { useKeybind } from "src/lib/keybind";
import { Username } from "./Username";

export function MentionSearch({
  query,
  onPick,
}: Readonly<{
  query: string;
  onPick: (author: Author) => void;
}>) {
  const authors = useAuthors();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(0);

  const results = useMemo(() => {
    const q = query.toLowerCase();
    return Object.values(authors ?? {})
      .filter((a) => a.username && a.username.toLowerCase().includes(q))
      .sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""))
      .slice(0, 10);
  }, [authors, query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (results.length > 0) setHoveredIndex(0);
  }, [results]);

  useKeybind("arrowup", () => {
    if (hoveredIndex === null) setHoveredIndex(0);
    else setHoveredIndex((hoveredIndex - 1 + results.length) % results.length);
  });

  useKeybind("arrowdown", () => {
    if (hoveredIndex === null) setHoveredIndex(0);
    else setHoveredIndex((hoveredIndex + 1) % results.length);
  });

  useKeybind("enter", () => {
    if (hoveredIndex === null) return;
    const a = results[hoveredIndex];
    if (a) onPick(a);
  });

  useKeybind("tab", () => {
    if (hoveredIndex === null) return;
    const a = results[hoveredIndex];
    if (a) onPick(a);
  });

  useKeybind("escape", () => {
    // just close the picker; caller controls query string
    setHoveredIndex(null);
  });

  return (
    <div className="bg-tertiary text-primary w-full flex flex-col">
      <Label className="p-2">mentions matching @{query}</Label>
      {results.map((a, index) => (
        <div
          key={a.id}
          onClick={() => onPick(a)}
          onMouseEnter={() => setHoveredIndex(index)}
          className={classes(
            "flex items-center gap-2 hover:bg-secondary/25 cursor-pointer p-2",
            hoveredIndex === index && "bg-secondary/25"
          )}
        >
          <span className="opacity-80">@</span>
          <Username author={a} />
        </div>
      ))}
      {results.length === 0 && (
        <div className="p-2 text-secondary">no matches</div>
      )}
    </div>
  );
}
