import { notFound } from "next/navigation";
import { FeedDestinationShell } from "@/components/feed/FeedDestinationShell";
import { getFeedItemById } from "@/lib/feed/query";
import { getSessionUser } from "@/lib/auth/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getFeedItemById(id);
  if (!item || item.type !== "listing") return {};
  const seller = item.brand?.name ?? `@${item.author.username}`;
  return {
    title: item.title ?? "Listing",
    description: `Listing by ${seller} on Scrlpets.`,
  };
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, user] = await Promise.all([getFeedItemById(id), getSessionUser()]);
  if (!item || item.type !== "listing") notFound();
  return <FeedDestinationShell item={item} viewerId={user?.id} />;
}
