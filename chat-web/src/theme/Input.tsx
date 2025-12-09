type InputProps = Styleable &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
    onChange?:
      | ((value: string) => void)
      | React.Dispatch<React.SetStateAction<string>>;
  };

export function Input({ className, onChange, ...props }: InputProps) {
  return (
    <input
      className={classes(
        "border border-black/20 dark:border-white/20 rounded px-2 py-1 active:outline-none focus:outline-none active:ring focus:ring-1 focus:ring-black/50 dark:focus:ring-primary/30",
        className
      )}
      onChange={(e) => onChange?.(e.target.value)}
      {...props}
    />
  );
}
