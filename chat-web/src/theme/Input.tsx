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
        "border border-neutral-800 px-2 py-1 active:outline-none focus:outline-none",
        className
      )}
      onChange={(e) => onChange?.(e.target.value)}
      {...props}
    />
  );
}
