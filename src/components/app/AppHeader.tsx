import Link from "next/link";
import { Bell, MessageCircle, Plus, Search } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { FeedTabs } from "@/components/feed/FeedTabs";

export function AppHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/88 px-4 pb-3 pt-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/" aria-label="Scrlpets home" className="rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
          <Wordmark size={23} />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/shop"
            className="grid size-9 place-items-center rounded-full border border-border/80 bg-muted/45 text-muted-foreground transition hover:text-foreground"
            aria-label="Search"
          >
            <Search className="size-4" aria-hidden />
          </Link>
          {signedIn ? (
            <>
              <Link
                href="/messages"
                className="grid size-9 place-items-center rounded-full border border-border/80 bg-muted/45 text-muted-foreground transition hover:text-foreground"
                aria-label="Messages"
                data-testid="messages-link"
              >
                <MessageCircle className="size-4" aria-hidden />
              </Link>
              <Link
                href="/compose"
                className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_22px_rgba(126,48,58,.35)] transition hover:bg-primary/90"
                aria-label="Create post"
                data-testid="compose-cta"
              >
                <Plus className="size-4" aria-hidden />
              </Link>
            </>
          ) : (
            <Link href="/login" className="text-sm font-medium text-brand-link underline" data-testid="signin-cta">
              Sign in
            </Link>
          )}
          <Link
            href="/menu"
            className="relative grid size-9 place-items-center rounded-full border border-border/80 bg-muted/45 text-muted-foreground transition hover:text-foreground"
            aria-label="Menu"
          >
            <Bell className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
      <FeedTabs />
    </header>
  );
}
