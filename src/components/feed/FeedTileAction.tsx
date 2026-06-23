import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FeedItem } from "@/lib/feed/types";
import { getFeedDestination } from "@/lib/feed/destinations";

export function FeedTileAction({ item }: { item: FeedItem }) {
  const t = useTranslations("feed");
  const destination = getFeedDestination(item);

  return (
    <Link
      href={destination.href}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring"
      data-testid={`tile-destination-${destination.kind}`}
    >
      <span>{t(destination.labelKey)}</span>
      <ArrowRight aria-hidden className="h-4 w-4" />
    </Link>
  );
}
