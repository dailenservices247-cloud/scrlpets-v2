import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppPage({ children }: { children: ReactNode }) {
  return (
    <main className="app-surface min-h-dvh pb-24" data-testid="app-shell">
      {children}
      <BottomNav />
    </main>
  );
}
