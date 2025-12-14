import { Loader2Icon, type LucideIcon } from "lucide-react";

export type Icon = string | LucideIcon;

type ButtonProps = Styleable &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
    onClick?: (() => void) | React.MouseEventHandler<HTMLButtonElement>;
    variant?: "primary" | "transparent" | "danger";
    icon?: Icon;
    loading?: boolean;
    disabled?: boolean;
  };

function Icon({ icon }: { icon: Icon }) {
  if (typeof icon === "string") {
    return <span className="font-bold px-1">{icon}</span>;
  } else {
    const Lucide = icon;
    return <Lucide className="h-4 w-4" size={16} />;
  }
}

export function Button({
  className,
  onClick,
  children,
  icon,
  variant = "primary",
  loading = false,
  disabled = false,
  ...props
}: ButtonProps) {
  if (loading) {
    disabled = true;
  }

  return (
    <button
      className={classes(
        "active:outline-none flex items-center cursor-pointer justify-between gap-2 focus:outline-none transition-colors opacity-70 hover:opacity-100 ",
        !children && icon && "gap-0.5",
        children &&
          !icon &&
          variant !== "transparent" &&
          "bg-tertiary/50 hover:bg-tertiary/70",
        variant === "danger" && "bg-red-500/50 hover:bg-red-500/70",
        disabled && "opacity-25 pointer-events-none",
        className
      )}
      onClick={(e) => {
        if (disabled) {
          return;
        }
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
      disabled={disabled}
      {...props}
    >
      {loading ? (
        <Loader2Icon className="h-4 w-4 animate-spin" size={16} />
      ) : (
        icon && <Icon icon={icon} />
      )}
      {children && (
        <>
          <span>[</span>
          {children}
          <span>]</span>
        </>
      )}
    </button>
  );
}
