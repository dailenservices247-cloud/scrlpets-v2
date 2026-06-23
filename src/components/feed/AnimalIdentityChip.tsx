import Link from "next/link";
import type { FeedItem } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

type Creature = NonNullable<FeedItem["creature"]>;

export function AnimalIdentityChip({
  creature,
  className,
}: {
  creature: Creature;
  className?: string;
}) {
  return (
    <Link
      href={`/c/${creature.slug}`}
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-secondary/50 bg-secondary/15 px-2.5 py-1 text-sm font-medium text-foreground transition hover:border-secondary hover:bg-secondary/20 focus:outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
      data-testid="creature-name"
    >
      {creature.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={creature.avatarUrl}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 rounded-full object-cover"
        />
      ) : (
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs text-secondary-foreground"
          aria-hidden
        >
          {creature.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="truncate">{creature.name}</span>
    </Link>
  );
}
