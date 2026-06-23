import type { FeedItem } from "@/lib/feed/types";
import { FeedCardShell } from "../FeedCardShell";
import { FeedTileAction } from "../FeedTileAction";
import { TileMedia } from "../TileMedia";

export function PostTile({ item }: { item: FeedItem }) {
  return (
    <FeedCardShell item={item}>
      <p className="text-[17px] font-medium leading-snug tracking-tight">{item.title}</p>
      <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
      <FeedTileAction item={item} />
    </FeedCardShell>
  );
}
