import { cn } from "@lib/utils";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="font-display text-xs uppercase tracking-wider text-arcane"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "w-full px-4 py-3",
          "bg-void-deep border-2 border-mist/50",
          "text-text placeholder:text-text-dim/50",
          "font-body text-base",
          "transition-all duration-200",
          "focus:outline-none focus:border-arcane focus:shadow-[0_0_15px_rgba(200,170,110,0.2)]",
          "hover:border-mist",
          error && "border-danger focus:border-danger",
          className
        )}
        {...props}
      />
      {error && (
        <span className="text-xs text-danger font-body">{error}</span>
      )}
    </div>
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function TextArea({ label, error, className, id, ...props }: TextAreaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="font-display text-xs uppercase tracking-wider text-arcane"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          "w-full px-4 py-3 min-h-[120px] resize-y",
          "bg-void-deep border-2 border-mist/50",
          "text-text placeholder:text-text-dim/50",
          "font-mono text-sm",
          "transition-all duration-200",
          "focus:outline-none focus:border-arcane focus:shadow-[0_0_15px_rgba(200,170,110,0.2)]",
          "hover:border-mist",
          error && "border-danger focus:border-danger",
          className
        )}
        {...props}
      />
      {error && (
        <span className="text-xs text-danger font-body">{error}</span>
      )}
    </div>
  );
}

