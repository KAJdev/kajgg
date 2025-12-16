import type { Author } from "@schemas/models/author";
import { Label } from "@theme/Label";
import { useMemo } from "react";
import { useAuthors } from "src/lib/cache";
import { useKeybind } from "src/lib/keybind";
import { Username } from "./Username";
import { useParams } from "react-router";
import { cache } from "src/lib/cache";

export function MentionSearch({
  query,
  onPick,
}: Readonly<{
  query: string | null;
  onPick: (author: Author) => void;
}>) {
  const authors = useAuthors();
  const { channelId } = useParams();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(0);

  const results = useMemo(() => {
    if (query === null) return [];

    const q = query.toLowerCase();

    if (q.length === 0) {
      // return past 10 message authors in the current channel that arent the current user, and then grab random people from the cache
      if (channelId) {
        const channelMessages = cache.getState().messages[channelId] ?? {};
        return Object.values(channelMessages)
          .filter((m) => m.author_id !== cache.getState().user?.id)
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, 10)
          .map((m) => m.author ?? authors[m.author_id]);
      }

      return Object.values(authors ?? {}).slice(0, 10);
    }

    return Object.values(authors ?? {})
      .filter((a) => a.username && a.username.toLowerCase().includes(q))
      .sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""))
      .slice(0, 10);
  }, [authors, channelId, query]);

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

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="bg-background border-x border-t border-tertiary text-primary w-full flex flex-col absolute top-0 -translate-y-full">
      <Label className="p-2">users matching @{query}</Label>
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
