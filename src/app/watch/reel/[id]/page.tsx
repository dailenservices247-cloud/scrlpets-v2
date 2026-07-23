import { notFound } from "next/navigation";
import { ReelRealm } from "@/components/feed/ReelRealm";
import { getSessionUser } from "@/lib/auth/session";
import { getFeedItemById, getReelQueue } from "@/lib/feed/query";
import { getFeedSocialContext } from "@/lib/social/reactions";

// F4 / punch list A4: the reel destination IS the realm.
export default async function ReelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getFeedItemById(id);
  if (!item || item.type !== "reel") notFound();

  const user = await getSessionUser();
  let queue = await getReelQueue();
  // The tapped reel leads even if it aged out of the queue window.
  if (!queue.some((reel) => reel.id === id)) queue = [item, ...queue];
  const social = await getFeedSocialContext(
    queue.map((reel) => reel.id),
    user?.id,
  );

  return (
    <ReelRealm
      items={queue}
      startId={id}
      social={Object.fromEntries(social)}
      signedIn={Boolean(user)}
    />
  );
}
