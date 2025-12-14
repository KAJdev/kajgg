declare module "react-twemoji" {
  import type * as React from "react";

  type TwemojiProps = {
    readonly children?: React.ReactNode;
    readonly noWrapper?: boolean;
    readonly options?: Record<string, unknown>;
    readonly tag?: string;
    readonly className?: string;
  };

  export default class Twemoji extends React.Component<TwemojiProps> {}
}
