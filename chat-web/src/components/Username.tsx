import { hashString } from "src/lib/utils";

const colors = [
  "#c084fc", // vibrant purple
  "#a21caf", // deep purple
  "#f472b6", // vibrant fuchsia
  "#7c3aed", // intense violet
  "#6d28d9", // rich violet
  "#6366f1", // vivid indigo
  "#2563eb", // strong blue
  "#0ea5e9", // sky blue
  "#06b6d4", // cyan
  "#10b981", // vibrant emerald
  "#22d3ee", // strong cyan
  "#2dd4bf", // teal
  "#a3e635", // lime green
  "#fde047", // bold yellow
  "#fbbf24", // strong amber
  "#fb7185", // hot rose
  "#facc15", // strong yellow
  "#fd8e23", // orange
  "#f43f5e", // strong red
  "#e879f9", // vibrant pink
  "#f87171", // vivid red-pink
  "#fcd34d", // bright yellow
  "#38bdf8", // vivid blue
  "#4ade80", // strong green
  "#22c55e", // emerald green
  "#f472b6", // strong pink
  "#fb7185", // hot pink
  "#fbb6ce", // high-contrast light pink
  "#fb923c", // vibrant orange
  "#ffe0f7", // vibrant white-pink
];

function getColor(authorId: string) {
  return colors[hashString(authorId) % colors.length];
}

export function Username({
  id,
  username,
  noColor,
}: {
  id: string;
  username: string;
  noColor?: boolean;
}) {
  return (
    <span
      className="overflow-hidden text-ellipsis whitespace-nowrap"
      style={{ color: noColor ? undefined : getColor(id) }}
    >
      {username}
    </span>
  );
}
