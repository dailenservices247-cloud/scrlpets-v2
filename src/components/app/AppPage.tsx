import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { Footer } from "./Footer";
import { SideNav } from "./SideNav";
import { NotificationAnnouncer } from "@/components/notifications/NotificationAnnouncer";
import { getSessionUser } from "@/lib/auth/session";
import { getUnreadCount } from "@/lib/notifications/queries";

// F7: responsive web shell. Desktop (lg+) = left SideNav + a centered readable
// content column; mobile = full-width column + fixed BottomNav (unchanged).
//
// The header and footer live here rather than on individual routes: rendered on
// one route each, persistent chrome is not persistent. `showBottomNav={false}`
// means "full-screen task" (compose, onboarding, edit) — those keep their own
// cancel/back and get no shell chrome at all, header and footer included.
export async function AppPage({
  children,
  header,
  showBottomNav = true,
}: {
  children: ReactNode;
  /** Extra row inside the app header, under the wordmark. Feed uses it for the composer prompt. */
  header?: ReactNode;
  showBottomNav?: boolean;
}) {
  // Only read for the chrome that displays it — a full-screen task pays nothing.
  const user = showBottomNav ? await getSessionUser() : null;
  const unreadCount = user ? await getUnreadCount() : 0;
  return (
    <div className="lg:mx-auto lg:flex lg:max-w-5xl">
      {showBottomNav && <SideNav />}
      {/* Header, content and footer stack in one column so the header is a
          sibling of <main> — a <header> nested inside main is not a banner
          landmark, and `app-shell` stays scoped to the page's own content. */}
      <div className="app-surface flex min-h-dvh w-full min-w-0 flex-col lg:max-w-2xl lg:border-x lg:border-border/60">
        {showBottomNav && (
          <AppHeader signedIn={Boolean(user)} unreadCount={unreadCount}>
            {header}
          </AppHeader>
        )}
        <main className={"w-full flex-1 " + (showBottomNav ? "" : "pb-6")} data-testid="app-shell">
          {children}
        </main>
        {/* Clears the fixed BottomNav itself, which is why main no longer carries pb-24. */}
        {showBottomNav && <Footer />}
      </div>
      {/* Lives in the shell, not on /notifications. Announcing new mail only on
          the page where you can already see it is the one place it is useless.
          It seeds its own baseline from the first poll, so no server read is
          added to every page render. */}
      {showBottomNav && <NotificationAnnouncer />}
      {showBottomNav && <BottomNav />}
    </div>
  );
}
