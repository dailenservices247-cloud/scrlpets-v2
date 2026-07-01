import Link from "next/link";
import { Building2 } from "lucide-react";
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
      {item.brand ? (
        <>
          <span
            className="flex min-w-0 items-center gap-1 truncate text-xs font-semibold text-foreground"
            data-testid="brand-attribution"
          >
            <Building2 className="size-3 shrink-0 text-brand-link" aria-hidden />
            <span className="truncate">{item.brand.name}</span>
          </span>
          <Link
            href={`/u/${item.author.username}`}
            className="min-w-0 truncate text-[11px] text-muted-foreground transition hover:text-brand-link hover:underline"
          >
            via @{item.author.username}
          </Link>
        </>
      ) : (
        <Link
          href={`/u/${item.author.username}`}
          className="min-w-0 truncate text-xs font-medium text-muted-foreground transition hover:text-brand-link hover:underline"
        >
          @{item.author.username}
        </Link>
      )}
    </div>
  );
}
