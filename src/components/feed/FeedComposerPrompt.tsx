import Link from "next/link";
import { ImagePlus } from "lucide-react";

export function FeedComposerPrompt({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="border-b border-border/80 bg-background/80 px-4 py-3" data-testid="feed-composer-prompt">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-semibold text-brand-link">
          S
        </span>
        <Link
          href={signedIn ? "/compose" : "/login"}
          className="flex min-h-11 flex-1 items-center rounded-full border border-border/80 bg-muted/45 px-4 text-left text-sm font-semibold text-foreground transition hover:border-primary/45"
          data-testid="compose-cta"
        >
          Share an animal update
        </Link>
        <Link
          href={signedIn ? "/compose" : "/login"}
          className="grid size-10 place-items-center rounded-full border border-border/80 bg-muted/45 text-muted-foreground transition hover:text-foreground"
          aria-label="Add photo or video"
        >
          <ImagePlus className="size-5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
