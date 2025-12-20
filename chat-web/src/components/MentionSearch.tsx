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

    const results: Author[] = [];

    if (q.length === 0) {
      if (channelId) {
        const channelMessages = cache.getState().messages[channelId] ?? {};
        const currentUserId = cache.getState().user?.id ?? null;
        const messageList = Object.values(channelMessages).sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const addedIds = new Set<string>();
        for (const m of messageList) {
          if (
            m.author_id &&
            m.author_id !== currentUserId &&
            !addedIds.has(m.author_id)
          ) {
            const authorObj: Author | undefined =
              m.author ?? authors[m.author_id];
            if (authorObj) {
              results.push(authorObj);
              addedIds.add(m.author_id);
              if (results.length >= 10) break;
            }
          }
        }
      }

      // Fill up with random authors if we didn't get 10
      if (results.length < 10) {
        for (const a of Object.values(authors ?? {})) {
          if (results.some((r) => r.id === a.id)) continue;
          results.push(a);
          if (results.length >= 10) break;
        }
      }
    }

    return results;
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
