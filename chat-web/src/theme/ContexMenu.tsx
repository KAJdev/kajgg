import React from "react";
import { contextMenuState, setContextMenuState } from "src/lib/cache";
import { Popover } from "react-tiny-popover";
import { Button } from "@theme/Button";

function PopoverContent({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const rewriteNode = (node: React.ReactNode): React.ReactNode => {
    if (!React.isValidElement(node)) {
      return node;
    }

    const isButton =
      node.type === Button ||
      (typeof node.type === "function" &&
        // this is gross but it works for function components
        (node.type as { name?: string }).name === "Button");

    const nodeProps = node.props as { children?: React.ReactNode };
    const nextChildren =
      "children" in nodeProps
        ? React.Children.map(nodeProps.children, rewriteNode)
        : nodeProps.children;

    if (!isButton) {
      return React.cloneElement(node, undefined, nextChildren);
    }

    const props = (node.props ?? {}) as {
      className?: string;
      onClick?: unknown;
      closeContextMenu?: boolean;
    };

    const closeContextMenu = props.closeContextMenu ?? true;
    const onClick = props.onClick as
      | (() => void)
      | React.MouseEventHandler<HTMLButtonElement>
      | undefined;

    return React.cloneElement(
      node,
      {
        className: `${props.className ?? ""} w-full`,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          if (typeof onClick === "function") {
            if (onClick.length === 0) {
              (onClick as () => void)();
            } else {
              (onClick as React.MouseEventHandler<HTMLButtonElement>)(e);
            }
          }

          if (closeContextMenu) {
            setContextMenuState(null, null);
          }
        },
      } as React.ComponentProps<React.ElementType<typeof node>>,
      nextChildren
    );
  };

  const content = React.Children.map(children, rewriteNode);

  return (
    <div className="bg-background border border-tertiary flex flex-col gap-2 p-2 w-40">
      {content}
    </div>
  );
}

export function ContextMenu() {
  const { position, content } = contextMenuState();

  return (
    <Popover
      content={<PopoverContent>{content}</PopoverContent>}
      positions={["right", "left", "top", "bottom"]}
      isOpen={position != null && content != null}
      align="start"
      onClickOutside={(e) => {
        if (e.button === 2) return;
        setContextMenuState(null, null);
      }}
    >
      <div
        style={{ position: "absolute", left: position?.x, top: position?.y }}
      />
    </Popover>
  );
}
