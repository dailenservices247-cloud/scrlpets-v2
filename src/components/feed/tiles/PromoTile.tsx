import type { FeedItem } from "@/lib/feed/types";
import { useTranslations } from "next-intl";
import { FeedCardShell } from "../FeedCardShell";
import { FeedTileAction } from "../FeedTileAction";
import { TileMedia } from "../TileMedia";

export function PromoTile({ item }: { item: FeedItem }) {
  const t = useTranslations("feed");
  return (
    <FeedCardShell item={item} className="bg-accent/5">
      <div className="rounded-lg border border-accent/30 bg-background/35 p-3" data-testid="product-summary">
        <p className="eyebrow">{t("productIntent")}</p>
        <p className="mt-1 font-semibold leading-snug">{item.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("productContext")}</p>
      </div>
      <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
      <FeedTileAction item={item} />
    </FeedCardShell>
  );
}
