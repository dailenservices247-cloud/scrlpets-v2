import { notFound } from "next/navigation";
import { FeedDestinationShell } from "@/components/feed/FeedDestinationShell";
import { getFeedItemById } from "@/lib/feed/query";

export default async function ReelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getFeedItemById(id);
  if (!item || item.type !== "reel") notFound();
  return <FeedDestinationShell item={item} />;
}
