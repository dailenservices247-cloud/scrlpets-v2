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
        "inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-secondary/45 bg-secondary/20 px-2 py-1 text-sm font-semibold text-foreground shadow-inner transition hover:border-secondary hover:bg-secondary/25 focus:outline-none focus:ring-2 focus:ring-ring",
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
          className="h-7 w-7 rounded-full object-cover ring-1 ring-white/20"
        />
      ) : (
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs text-secondary-foreground"
          aria-hidden
        >
          {creature.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="truncate">{creature.name}</span>
    </Link>
  );
}
