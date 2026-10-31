import type { FeedItem } from "@/lib/feed/types";
import { useTranslations } from "next-intl";
import { FeedCardShell } from "../FeedCardShell";
import { FeedTileAction } from "../FeedTileAction";
import { TileMedia } from "../TileMedia";
import { ShareButton } from "@/components/share/ShareButton";
import { realmTransitionName } from "@/lib/feed/realm-transition";

export function LongVideoTile({ item, canManage }: { item: FeedItem; canManage?: boolean }) {
  const t = useTranslations("feed");
  return (
    <FeedCardShell item={item} canManage={canManage}>
      <p className="eyebrow">{t("longVideoContext")}</p>
      <p className="text-title font-medium leading-snug">{item.title}</p>
      <TileMedia
        src={item.mediaUrl}
        alt={item.title ?? ""}
        transitionName={realmTransitionName(item.type, item.id)}
      />
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
        <ShareButton
          url={`https://scrlpets.com/watch/${item.id}`}
          title={item.title ?? "Full Video on Scrlpets"}
          mediaUrl={item.mediaUrl}
          variant="outline"
        />
        <FeedTileAction item={item} />
      </div>
    </FeedCardShell>
  );
}
