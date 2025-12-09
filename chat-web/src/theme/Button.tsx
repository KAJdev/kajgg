type ButtonProps = Styleable &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
    onClick?: (() => void) | React.MouseEventHandler<HTMLButtonElement>;
    variant?: "primary" | "secondary" | "transparent" | "danger";
  };

export function Button({
  className,
  onClick,
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={classes(
        "rounded px-3 py-1 active:outline-none focus:outline-none transition-colors font-[450]",
        variant === "primary" && "bg-primary text-black",
        variant === "secondary" &&
          "bg-secondary ring-[1px] ring-black/20 dark:ring-white/20",
        variant === "transparent" && "bg-transparent text-black",
        variant === "danger" && "bg-danger text-black",
        className
      )}
      onClick={(e) => {
        if (typeof onClick === "function") {
          if (onClick.length === 0) {
            // If provided as a () => void, call directly:
            (onClick as () => void)();
          } else {
            // Provided as a React.MouseEventHandler
            (onClick as React.MouseEventHandler<HTMLButtonElement>)(e);
          }
        }
      }}
      {...props}
    />
  );
}
