import React from "react";

export type TabProps = StyleableWithChildren & {
  name: string;
  value: string;
  active?: boolean;
  onClick?: () => void;
};

export function Tab({ name, active, className, onClick, children }: TabProps) {
  return (
    <div
      className={classes(
        "cursor-pointer px-2",
        active
          ? "bg-primary text-background font-semibold"
          : "text-secondary/80 hover:text-primary",
        className
      )}
      onClick={onClick}
      style={{ userSelect: "none" }}
    >
      {children ?? name}
    </div>
  );
}

export type TabsProps = StyleableWithChildren & {
  value: string;
  onChange: (value: string) => void;
};

export function Tabs({ children, value, onChange, className }: TabsProps) {
  return (
    <div className={classes("flex flex-row items-center gap-2", className)}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        const tabValue = (child.props as TabProps).value;
        const tabName = (child.props as TabProps).name;
        return React.cloneElement(child, {
          active: tabValue === value,
          onClick: () => onChange(tabValue),
          name: tabName,
        } as TabProps);
      })}
    </div>
  );
}
