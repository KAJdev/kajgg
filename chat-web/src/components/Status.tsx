import type { Status as StatusType } from "src/types";

export function Status({ status }: { status?: StatusType }) {
  return (
    <span
      className={classes(
        status === "online" && "text-green-500",
        status === "away" && "text-yellow-500",
        status === "do_not_disturb" && "text-red-500",
        status === "offline" && "text-tertiary"
      )}
    >
      {status === "online" ? "+" : "-"}
    </span>
  );
}
