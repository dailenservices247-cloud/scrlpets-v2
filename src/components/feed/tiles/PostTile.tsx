import type { FeedItem } from "@/lib/feed/types";
import { FeedCardShell } from "../FeedCardShell";
import { FeedTileAction } from "../FeedTileAction";
import { TileMedia } from "../TileMedia";

export function PostTile({ item, canManage }: { item: FeedItem; canManage?: boolean }) {
  return (
    <FeedCardShell item={item} canManage={canManage}>
      <p className="text-[17px] font-medium leading-snug tracking-tight">{item.title}</p>
      <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
      <FeedTileAction item={item} />
    </FeedCardShell>
  );
}
