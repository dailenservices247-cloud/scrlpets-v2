import Link from "next/link";
import { Plus } from "lucide-react";
import type { FeedItem } from "@/lib/feed/types";

type Moment = {
  href: string;
  label: string;
  imageUrl: string | null;
};

function getMoments(items: FeedItem[]): Moment[] {
  const seen = new Set<string>();
  const moments: Moment[] = [];

  for (const item of items) {
    if (!item.creature || seen.has(item.creature.id)) continue;
    seen.add(item.creature.id);
    moments.push({
      href: `/c/${item.creature.slug}`,
      label: item.creature.name,
      imageUrl: item.creature.avatarUrl ?? item.mediaUrl,
    });
    if (moments.length >= 8) break;
  }

  return moments;
}

export function UpdatesMomentsRail({
  items,
  signedIn,
}: {
  items: FeedItem[];
  signedIn: boolean;
}) {
  const moments = getMoments(items);

  return (
    <section className="border-b border-border/80 bg-background/70 py-3" data-testid="updates-moments">
      <div className="mb-2 flex items-center justify-between px-4">
        <p className="eyebrow">Updates & Moments</p>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1">
        <Link
          href={signedIn ? "/compose" : "/login"}
          className="relative flex h-28 w-24 shrink-0 flex-col justify-end overflow-hidden rounded-2xl border border-border/80 bg-muted/55 p-3 text-sm font-semibold"
          data-testid="create-moment"
        >
          <span className="absolute left-3 top-3 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
            <Plus className="size-4" aria-hidden />
          </span>
          <span>Create update</span>
        </Link>
        {moments.map((moment) => (
          <Link
            href={moment.href}
            key={moment.href}
            className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl border border-border/80 bg-card"
          >
            {moment.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={moment.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center bg-secondary/25 text-2xl font-semibold">
                {moment.label.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 text-sm font-semibold text-white">
              {moment.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
