import { hashString } from "src/lib/utils";

const colors = [
  "#f3e8ff", // bg-purple-100
  "#e9d5ff", // bg-purple-200
  "#f5d0fe", // bg-fuchsia-200
  "#ede9fe", // bg-violet-100
  "#ddd6fe", // bg-violet-200
  "#e0e7ff", // bg-indigo-100
  "#c7d2fe", // bg-indigo-200
  "#dbeafe", // bg-blue-100
  "#bae6fd", // bg-sky-200
  "#a7f3d0", // bg-emerald-200
  "#a5f3fc", // bg-cyan-200
  "#cffafe", // bg-cyan-100
  "#adfa1d", // pastel lime-green
  "#fef9c3", // bg-yellow-100
  "#fef3c7", // bg-amber-100
  "#ffe4e6", // bg-rose-100
  "#fde68a", // bg-yellow-200
  "#fed7aa", // bg-orange-200
  "#fecaca", // bg-red-200
  "#fad5ec", // pastel pink
  "#fde7e7", // pastel red-pink
  "#fdf6b2", // pastel yellow
  "#dbf4ff", // pastel light-blue
  "#d1fae5", // bg-green-100
  "#bbf7d0", // bg-green-200
  "#fecdd3", // bg-pink-200
  "#fbcfe8", // bg-pink-100
  "#fcd8e4", // pastel light-pink
  "#ffedd5", // bg-orange-100
  "#fff0f6", // pastel white-pink
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
    <span style={{ color: noColor ? undefined : getColor(id) }}>
      {username}
    </span>
  );
}
