import { Status as StatusType } from "src/types";

const CHARACTERS = {
  [StatusType.ONLINE]: "+",
  [StatusType.AWAY]: "-",
  [StatusType.DO_NOT_DISTURB]: "DND",
  [StatusType.OFFLINE]: "x",
};

export function Status({ status }: { status?: StatusType }) {
  return (
    <span
      className={classes(
        "shrink-0",
        status === StatusType.ONLINE && "text-green-500",
        status === StatusType.AWAY && "text-yellow-500",
        status === StatusType.DO_NOT_DISTURB && "text-red-500",
        status === StatusType.OFFLINE && "text-tertiary"
      )}
    >
      {CHARACTERS[status ?? StatusType.ONLINE]}
    </span>
  );
}
