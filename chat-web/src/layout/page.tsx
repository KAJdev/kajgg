export function Page({ children, className }: StyleableWithChildren) {
  return (
    <div
      className={classes(
        "grid h-dvh w-dvw bg-neutral-950 min-h-0 text-emerald-100 font-mono text-sm overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}
