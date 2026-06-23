import Link from "next/link";
import type { FeedItem } from "@/lib/feed/types";
import { cn } from "@/lib/utils";
import { AnimalIdentityChip } from "./AnimalIdentityChip";

export function AttributionStack({
  item,
  className,
}: {
  item: FeedItem;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)} data-testid="attribution-stack">
      {item.creature ? <AnimalIdentityChip creature={item.creature} /> : null}
      <Link
        href={`/u/${item.author.username}`}
        className="min-w-0 truncate text-xs text-muted-foreground transition hover:text-brand-link hover:underline"
      >
        @{item.author.username}
      </Link>
    </div>
  );
}
