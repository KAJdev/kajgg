export const MessageType = {
  DEFAULT: "default",
  JOIN: "join",
  LEAVE: "leave",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];
