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
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground shadow-[0_10px_24px_rgba(42,96,85,.24)] transition hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-ring"
      data-testid={`tile-destination-${destination.kind}`}
    >
      <span>{t(destination.labelKey)}</span>
      <ArrowRight aria-hidden className="h-4 w-4" />
    </Link>
  );
}
