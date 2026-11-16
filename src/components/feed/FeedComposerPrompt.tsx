import Link from "next/link";
import { ImagePlus, PawPrint } from "lucide-react";

export function FeedComposerPrompt({
  signedIn,
  avatarUrl,
  fallbackLabel,
}: {
  signedIn: boolean;
  avatarUrl?: string | null;
  fallbackLabel?: string | null;
}) {
  const fallback = (fallbackLabel?.trim() || "Guest").slice(0, 1).toUpperCase();

  return (
    <div data-testid="feed-composer-prompt">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-full object-cover ring-1 ring-white/15"
          />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-semibold text-brand-link">
            {fallback}
          </span>
        )}
        {signedIn ? (
          <Link
            href="/compose"
            className="flex min-h-11 flex-1 items-center rounded-full border border-border/80 bg-muted/45 px-4 text-left text-sm font-semibold text-foreground transition hover:border-primary/45"
            data-testid="compose-cta"
          >
            Share an animal update...
          </Link>
        ) : (
          <Link
            href="/login"
            className="flex min-h-11 flex-1 items-center rounded-full border border-border/80 bg-muted/45 px-4 text-left text-sm font-semibold text-foreground transition hover:border-primary/45"
            data-testid="compose-cta"
          >
            Sign in to share an update
          </Link>
        )}
        <Link
          href={signedIn ? "/compose" : "/login"}
          className="grid size-10 place-items-center rounded-full border border-border/80 bg-muted/45 text-muted-foreground transition hover:text-foreground hover:bg-muted"
          aria-label="Add photo or video"
        >
          <ImagePlus className="size-5" aria-hidden />
        </Link>
      </div>

      {signedIn && (
        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
          <Link
            href="/compose?mode=post"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          >
            <ImagePlus className="size-4 text-secondary-foreground" />
            <span>Photo / Video</span>
          </Link>
          <div className="h-4 w-px bg-border/60" />
          <Link
            href="/compose"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          >
            <PawPrint className="size-4 text-brand-link" />
            <span>Tag Animal</span>
          </Link>
        </div>
      )}
    </div>
  );
}
