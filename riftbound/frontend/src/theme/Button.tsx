import { cn } from "@lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  className,
  disabled,
  loading,
  ...props
}: ButtonProps) {
  const baseStyles = cn(
    "font-display font-semibold uppercase tracking-wider",
    "transition-all duration-200 ease-out",
    "border-2 relative overflow-hidden",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "focus:outline-none focus:ring-2 focus:ring-arcane/50"
  );

  const variants = {
    primary: cn(
      "bg-gradient-to-b from-arcane to-piltover",
      "border-arcane-glow/30 text-void",
      "hover:from-arcane-glow hover:to-arcane",
      "hover:shadow-[0_0_20px_rgba(200,170,110,0.4)]",
      "active:scale-[0.98]"
    ),
    secondary: cn(
      "bg-void-deep border-arcane/40 text-arcane",
      "hover:bg-shadow hover:border-arcane",
      "hover:shadow-[0_0_15px_rgba(200,170,110,0.2)]"
    ),
    ghost: cn(
      "bg-transparent border-transparent text-text-dim",
      "hover:text-text hover:bg-shadow/50"
    ),
    danger: cn(
      "bg-gradient-to-b from-noxus to-danger/80",
      "border-danger/50 text-arcane-glow",
      "hover:from-danger hover:to-noxus",
      "hover:shadow-[0_0_20px_rgba(232,64,87,0.4)]"
    ),
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-4 text-base",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          loading...
        </span>
      ) : (
        children
      )}
    </button>
  );
}

