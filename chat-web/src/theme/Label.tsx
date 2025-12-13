export type LabelProps = StyleableWithChildren & {
  children: React.ReactNode;
};

export function Label({ children, className }: LabelProps) {
  return (
    <div
      className={classes(
        "uppercase tracking-[0.08em] text-secondary/60",
        className
      )}
    >
      {children}
    </div>
  );
}
