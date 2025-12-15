import type { Channel } from "@schemas/models/channel";
import { Label } from "@theme/Label";
import { useMemo } from "react";
import { useChannels } from "src/lib/cache";
import { useKeybind } from "src/lib/keybind";

export function ChannelSearch({
  query,
  onPick,
}: Readonly<{
  query: string;
  onPick: (channel: Channel) => void;
}>) {
  const channels = useChannels();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(0);

  const results = useMemo(() => {
    const q = query.toLowerCase();
    return Object.values(channels ?? {})
      .filter((c) => c.name && c.name.toLowerCase().includes(q))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
      .slice(0, 10);
  }, [channels, query]);

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
    const c = results[hoveredIndex];
    if (c) onPick(c);
  });

  useKeybind("tab", () => {
    if (hoveredIndex === null) return;
    const c = results[hoveredIndex];
    if (c) onPick(c);
  });

  return (
    <div className="bg-tertiary text-primary w-full flex flex-col">
      <Label className="p-2">channels matching #{query}</Label>
      {results.map((c, index) => (
        <div
          key={c.id}
          onClick={() => onPick(c)}
          onMouseEnter={() => setHoveredIndex(index)}
          className={classes(
            "flex items-center gap-2 hover:bg-secondary/25 cursor-pointer p-2",
            hoveredIndex === index && "bg-secondary/25"
          )}
        >
          <span className="opacity-80">#{c.name}</span>
        </div>
      ))}
      {results.length === 0 && (
        <div className="p-2 text-secondary">no matches</div>
      )}
    </div>
  );
}
