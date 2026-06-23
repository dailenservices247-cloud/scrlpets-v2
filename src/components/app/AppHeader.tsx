import Link from "next/link";
import { Search } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";

export function AppHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-border/80 bg-background/88 px-4 py-3 backdrop-blur-xl" data-testid="app-header">
      <div className="flex items-center justify-between">
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
          {signedIn ? null : (
            <Link href="/login" className="text-sm font-medium text-brand-link underline" data-testid="signin-cta">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
