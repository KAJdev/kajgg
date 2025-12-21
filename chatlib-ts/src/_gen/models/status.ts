export const Status = {
  ONLINE: "online",
  OFFLINE: "offline",
  AWAY: "away",
  DO_NOT_DISTURB: "do_not_disturb",
} as const;

export type Status = (typeof Status)[keyof typeof Status];
