import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";

// F7: responsive web shell. Desktop (lg+) = left SideNav + a centered readable
// content column; mobile = full-width column + fixed BottomNav (unchanged).
export function AppPage({
  children,
  showBottomNav = true,
}: {
  children: ReactNode;
  showBottomNav?: boolean;
}) {
  return (
    <div className="lg:mx-auto lg:flex lg:max-w-5xl">
      {showBottomNav && <SideNav />}
      <main
        className={
          "app-surface min-h-dvh w-full lg:max-w-2xl lg:border-x lg:border-border/60 " +
          (showBottomNav ? "pb-24 lg:pb-8" : "pb-6")
        }
        data-testid="app-shell"
      >
        {children}
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
