export function Page({ children, className }: StyleableWithChildren) {
  return (
    <div
      className={classes(
        "grid h-dvh w-dvw min-h-0 font-mono text-sm overflow-hidden bg-background",
        className
      )}
    >
      {children}
    </div>
  );
}
