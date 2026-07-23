import Link from "next/link";
import type { FeedItem } from "@/lib/feed/types";
import { cn } from "@/lib/utils";
import { getFeedDestination } from "@/lib/feed/destinations";
import { relativeTime } from "@/lib/feed/relative-time";
import { AnimalIdentityChip } from "./AnimalIdentityChip";

function Avatar({
  src,
  name,
  size,
}: {
  src: string | null;
  name: string;
  size: "lg" | "sm";
}) {
  const dims = size === "lg" ? "size-10" : "size-5";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn(dims, "shrink-0 rounded-full object-cover")}
      />
    );
  }
  return (
    <span
      className={cn(
        dims,
        "grid shrink-0 place-items-center rounded-full bg-primary/25 font-semibold text-brand-link",
        size === "lg" ? "text-base" : "text-[10px]",
      )}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * FB/IG-style attribution header (punch list A10/A11):
 * - person post: avatar + real display name + time — no @handle in the feed.
 * - brand post: BRAND identity primary (avatar + name), the human operator
 *   demoted to a small avatar + display name underneath.
 */
export function AttributionStack({
  item,
  className,
}: {
  item: FeedItem;
  className?: string;
}) {
  const personName = item.author.displayName ?? item.author.username;
  const time = relativeTime(item.createdAt);

  if (item.brand) {
    return (
      <div className={cn("flex min-w-0 items-start gap-2.5", className)} data-testid="attribution-stack">
        <Avatar src={item.brand.avatarUrl} name={item.brand.name} size="lg" />
        <div className="min-w-0">
          <Link
            href={`/b/${item.brand.slug}`}
            className="block max-w-full truncate text-[15px] font-semibold leading-tight text-foreground transition hover:text-brand-link hover:underline"
            data-testid="brand-attribution"
          >
            {item.brand.name}
          </Link>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Avatar src={item.author.avatarUrl} name={personName} size="sm" />
            <Link
              href={`/u/${item.author.username}`}
              className="min-w-0 truncate transition hover:text-brand-link hover:underline"
            >
              {personName}
            </Link>
            <span aria-hidden>·</span>
            <Link
              href={getFeedDestination(item).href}
              className="hover:underline"
              data-testid="post-permalink"
            >
              <time dateTime={item.createdAt}>{time}</time>
            </Link>
          </div>
          {item.creature ? <AnimalIdentityChip creature={item.creature} className="mt-1" /> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-start gap-2.5", className)} data-testid="attribution-stack">
      <Avatar src={item.author.avatarUrl} name={personName} size="lg" />
      <div className="min-w-0">
        <Link
          href={`/u/${item.author.username}`}
          className="block max-w-full truncate text-[15px] font-semibold leading-tight text-foreground transition hover:text-brand-link hover:underline"
        >
          {personName}
        </Link>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link
            href={getFeedDestination(item).href}
            className="hover:underline"
            data-testid="post-permalink"
          >
            <time dateTime={item.createdAt}>{time}</time>
          </Link>
        </div>
        {item.creature ? <AnimalIdentityChip creature={item.creature} className="mt-1" /> : null}
      </div>
    </div>
  );
}
