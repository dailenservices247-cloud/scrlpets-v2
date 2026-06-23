import type { FeedItem } from "@/lib/feed/types";
import { useTranslations } from "next-intl";
import { FeedCardShell } from "../FeedCardShell";
import { FeedTileAction } from "../FeedTileAction";
import { TileMedia } from "../TileMedia";

export function LongVideoTile({ item }: { item: FeedItem }) {
  const t = useTranslations("feed");
  return (
    <FeedCardShell item={item}>
      <p className="eyebrow">{t("longVideoContext")}</p>
      <p className="font-medium leading-snug">{item.title}</p>
      <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
      <FeedTileAction item={item} />
    </FeedCardShell>
  );
}
