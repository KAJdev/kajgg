type ButtonProps = Styleable &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
    onClick?: (() => void) | React.MouseEventHandler<HTMLButtonElement>;
    variant?: "primary" | "danger";
  };

export function Button({
  className,
  onClick,
  children,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={classes(
        "active:outline-none flex items-center cursor-pointer justify-between gap-2 focus:outline-none transition-colors opacity-70 hover:opacity-100",
        variant === "danger" && "text-red-500",
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
    >
      <span>[</span>
      {children}
      <span>]</span>
    </button>
  );
}
