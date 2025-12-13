import React from "react";

export type OptionProps<T extends string> = StyleableWithChildren & {
  value: T;
  label: string;
};

export function Option<T extends string>({ value, label }: OptionProps<T>) {
  return <option value={value}>{label}</option>;
}

export type SelectProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  children:
    | React.ReactElement<OptionProps<T>>
    | Array<React.ReactElement<OptionProps<T>>>;
  className?: string;
};

export function Select<T extends string>({
  children,
  value,
  onChange,
  className,
}: SelectProps<T>) {
  return (
    <select
      onChange={(e) => onChange(e.target.value as T)}
      value={value}
      className={classes(
        "flex flex-row items-center gap-2 cursor-pointer focus:outline-none active:outline-none select-none border border-tertiary px-2 py-1",
        className
      )}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        const optionValue = (child.props as OptionProps<T>).value;
        const optionLabel = (child.props as OptionProps<T>).label;
        return <Option value={optionValue} label={optionLabel} />;
      })}
    </select>
  );
}
