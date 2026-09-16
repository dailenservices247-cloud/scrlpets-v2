import type { FeedItem } from "@/lib/feed/types";
import { useTranslations } from "next-intl";
import { FeedCardShell } from "../FeedCardShell";
import { FeedTileAction } from "../FeedTileAction";
import { TileMedia } from "../TileMedia";

export function ListingTile({ item, canManage }: { item: FeedItem; canManage?: boolean }) {
  const t = useTranslations("feed");
  return (
    <FeedCardShell item={item} className="bg-primary/5" canManage={canManage}>
      <div className="rounded-xl border border-primary/25 bg-background/45 p-3.5 shadow-inner" data-testid="listing-summary">
        <p className="eyebrow">{t("listingIntent")}</p>
        {/* An animal for sale is still an identity, so the title takes the
            serif — the same face its brand and its own name use. */}
        <p className="mt-1 font-serif text-title leading-snug">{item.title}</p>
        <p className="mt-1 text-meta text-muted-foreground">{t("listingContext")}</p>
      </div>
      <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
      <FeedTileAction item={item} />
    </FeedCardShell>
  );
}
