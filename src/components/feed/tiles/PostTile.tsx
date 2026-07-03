import type { FeedItem } from "@/lib/feed/types";
import { FeedCardShell } from "../FeedCardShell";
import { FeedTileAction } from "../FeedTileAction";
import { TileMedia } from "../TileMedia";

export function PostTile({ item, viewerId }: { item: FeedItem; viewerId?: string | null }) {
  return (
    <FeedCardShell item={item} viewerId={viewerId}>
      <p className="text-[17px] font-medium leading-snug tracking-tight">{item.title}</p>
      <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
      <FeedTileAction item={item} />
    </FeedCardShell>
  );
}
