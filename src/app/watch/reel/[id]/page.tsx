import { notFound } from "next/navigation";
import { ReelRealm } from "@/components/feed/ReelRealm";
import { getSessionUser } from "@/lib/auth/session";
import { getFeedItemById, getReelQueue } from "@/lib/feed/query";
import { getFeedSocialContext, getSavedSet } from "@/lib/social/reactions";
import { getFollowingIds } from "@/lib/social/follows";

// F4 / punch list A4: the reel destination IS the realm.
export default async function ReelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getFeedItemById(id);
  if (!item || item.type !== "reel") notFound();

  const user = await getSessionUser();
  let queue = await getReelQueue();
  // The tapped reel leads even if it aged out of the queue window.
  if (!queue.some((reel) => reel.id === id)) queue = [item, ...queue];
  const ids = queue.map((reel) => reel.id);
  const [social, savedSet, followingIds] = await Promise.all([
    getFeedSocialContext(ids, user?.id),
    user ? getSavedSet(user.id, ids) : Promise.resolve(new Set<string>()),
    user ? getFollowingIds(user.id) : Promise.resolve([]),
  ]);

  return (
    <ReelRealm
      items={queue}
      startId={id}
      social={Object.fromEntries(social)}
      savedIds={[...savedSet]}
      followingIds={followingIds}
      viewerId={user?.id ?? null}
      signedIn={Boolean(user)}
    />
  );
}
