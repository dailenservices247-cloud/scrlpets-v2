import { notFound, redirect } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { FeedDestinationShell } from "@/components/feed/FeedDestinationShell";
import { getFeedItemById } from "@/lib/feed/query";
import { getFeedDestination } from "@/lib/feed/destinations";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";


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
  const [item, user] = await Promise.all([getFeedItemById(id), getSessionUser()]);
  if (!item) notFound();
  // A reel or long video is a post-family row, and the notification triggers
  // write `target_kind = 'post'` for ALL of them — so every reaction and comment
  // notification on a reel pointed here and 404'd. Redirecting rather than
  // refusing repairs the notifications already sitting in the database, and the
  // sign-in-to-comment link that builds the same URL, without a backfill.
  if (item.type !== "post") redirect(getFeedDestination(item).href);
  return (
    <AppPage>
      <FeedDestinationShell item={item} viewerId={user?.id} />
    </AppPage>
  );
}
