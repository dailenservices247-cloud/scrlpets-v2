import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FeedItem } from "@/lib/feed/types";
import { getFeedDestination } from "@/lib/feed/destinations";

export function FeedTileAction({ item }: { item: FeedItem }) {
  const t = useTranslations("feed");
  const destination = getFeedDestination(item);

  // Brand House §7: standard actions are soft wine tint — the same recipe as the
  // Button component's default variant. Spine is reserved for trust and
  // verification surfaces, so it cannot be a tile's everyday CTA, and the
  // spine-tinted drop shadow went with it.
  return (
    <Link
      href={destination.href}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary/15 px-4 py-3 text-sm font-semibold text-brand-link transition hover:bg-primary/25 focus:outline-none focus:ring-2 focus:ring-ring"
      data-testid={`tile-destination-${destination.kind}`}
    >
      <span>{t(destination.labelKey)}</span>
      <ArrowRight aria-hidden className="h-4 w-4" />
    </Link>
  );
}
