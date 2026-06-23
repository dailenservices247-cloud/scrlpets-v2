import type { FeedItem } from "@/lib/feed/types";
import { useTranslations } from "next-intl";
import { FeedCardShell } from "../FeedCardShell";
import { FeedTileAction } from "../FeedTileAction";
import { TileMedia } from "../TileMedia";

export function ListingTile({ item }: { item: FeedItem }) {
  const t = useTranslations("feed");
  return (
    <FeedCardShell item={item} className="bg-primary/5">
      <div className="rounded-xl border border-primary/25 bg-background/45 p-3.5 shadow-inner" data-testid="listing-summary">
        <p className="eyebrow">{t("listingIntent")}</p>
        <p className="mt-1 text-[17px] font-semibold leading-snug tracking-tight">{item.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("listingContext")}</p>
      </div>
      <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
      <FeedTileAction item={item} />
    </FeedCardShell>
  );
}
