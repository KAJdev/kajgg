import type { LucideIcon } from "lucide-react";

export type Icon = string | LucideIcon;

type ButtonProps = Styleable &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
    onClick?: (() => void) | React.MouseEventHandler<HTMLButtonElement>;
    variant?: "primary" | "danger";
    icon?: Icon;
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
  ...props
}: ButtonProps) {
  return (
    <button
      className={classes(
        "active:outline-none flex items-center cursor-pointer justify-between gap-2 focus:outline-none transition-colors opacity-70 hover:opacity-100",
        variant === "danger" && "text-red-500",
        !children && icon && "gap-0.5",
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
      {icon && <Icon icon={icon} />}
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
