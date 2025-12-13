import { getColor } from "src/lib/utils";

export function Username({
  id,
  username,
  color,
  noColor,
}: {
  id: string;
  username: string;
  color?: string;
  noColor?: boolean;
}) {
  return (
    <span
      className="overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
      style={{
        color: noColor ? undefined : color ?? getColor(id),
        fontWeight: noColor ? "normal" : "bold",
      }}
    >
      {username}
    </span>
  );
}
