import type { ReactNode } from "react";

interface PageProps {
  children: ReactNode;
}

export function Page({ children }: PageProps) {
  return (
    <div className="min-h-screen bg-void">
      {children}
    </div>
  );
}

