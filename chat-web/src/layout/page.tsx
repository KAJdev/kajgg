export function Page({ children, className }: StyleableWithChildren) {
  return (
    <div className={classes("flex flex-col h-dvh w-dvw", className)}>
      {children}
    </div>
  );
}
