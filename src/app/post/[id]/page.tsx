import { notFound } from "next/navigation";
import { FeedDestinationShell } from "@/components/feed/FeedDestinationShell";
import { getFeedItemById } from "@/lib/feed/query";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getFeedItemById(id);
  if (!item || item.type !== "post") return {};
  const author = item.brand?.name ?? `@${item.author.username}`;
  return {
    title: item.title ? `${item.title.slice(0, 60)}` : "Post",
    description: `Post by ${author} on Scrlpets.`,
  };
}

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getFeedItemById(id);
  if (!item || item.type !== "post") notFound();
  return <FeedDestinationShell item={item} />;
}
