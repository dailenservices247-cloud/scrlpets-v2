import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppPage({
  children,
  showBottomNav = true,
}: {
  children: ReactNode;
  showBottomNav?: boolean;
}) {
  return (
    <main className={showBottomNav ? "app-surface min-h-dvh pb-24" : "app-surface min-h-dvh pb-6"} data-testid="app-shell">
      {children}
      {showBottomNav && <BottomNav />}
    </main>
  );
}
