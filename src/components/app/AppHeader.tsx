import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, Search } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";

export function AppHeader({
  signedIn,
  unreadCount = 0,
  children,
}: {
  signedIn: boolean;
  unreadCount?: number;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-border/80 bg-background/88 px-4 py-3 backdrop-blur-xl" data-testid="app-header">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="Scrlpets home" className="rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
          <Wordmark size={23} />
        </Link>
        {/* Search and notifications are hidden on desktop: SideNav carries both
            already, and once this header moved into the shell they appeared
            twice on every large screen. The header itself stays — the feed's
            composer prompt renders in it via `children`, and hiding the whole
            header would take that with it. */}
        <div className="flex items-center gap-2">
          {/* R11: this icon looked like search but linked to /shop — now that
              real search exists it goes where it says. */}
          <Link
            href="/search"
            className="grid size-9 place-items-center rounded-full border border-border/80 bg-muted/45 text-muted-foreground transition hover:text-foreground lg:hidden"
            aria-label="Search"
            data-testid="header-search"
          >
            <Search className="size-4" aria-hidden />
          </Link>
          {signedIn && (
            <Link
              href="/notifications"
              className="relative grid size-9 place-items-center rounded-full border border-border/80 bg-muted/45 text-muted-foreground transition hover:text-foreground lg:hidden"
              aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
              data-testid="header-notifications"
            >
              <Bell className="size-4" aria-hidden />
              {unreadCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                  data-testid="unread-badge"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          )}
          {signedIn ? null : (
            <Link href="/login" className="text-sm font-medium text-brand-link underline" data-testid="signin-cta">
              Sign in
            </Link>
          )}
        </div>
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}
