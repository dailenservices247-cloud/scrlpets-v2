import { getFeed, type FeedTab } from "@/lib/feed/query";

// The feed is per-viewer and changes on every post; never serve it from the
// static shell (the production-build E2E run caught stale content here).
import { getSessionUser } from "@/lib/auth/session";
import { FeedList } from "@/components/feed/FeedList";
import { AppPage } from "@/components/app/AppPage";
import { FeedComposerPrompt } from "@/components/feed/FeedComposerPrompt";
import { UpdatesMomentsRail } from "@/components/feed/UpdatesMomentsRail";
import { getProfileById } from "@/lib/profiles/queries";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser(); // null = guest (feed is public per G1-A); seam stays federation-ready
  const { tab } = await searchParams;
  const feedTab: FeedTab = tab === "for_you" ? "for_you" : "following";
  const [items, profile] = await Promise.all([
    getFeed(feedTab, user?.id),
    user ? getProfileById(user.id) : Promise.resolve(null),
  ]);
  // A signed-in Following feed that comes back empty = you follow nobody yet.
  const followingEmpty = feedTab === "following" && !!user && items.length === 0;
  return (
    // The header itself is the shell's now; the feed still owns the one row
    // that only makes sense here.
    <AppPage
      header={
        <FeedComposerPrompt
          signedIn={Boolean(user)}
          avatarUrl={profile?.avatarUrl}
          fallbackLabel={profile?.displayName ?? profile?.username ?? user?.email}
        />
      }
    >
      <UpdatesMomentsRail items={items} signedIn={Boolean(user)} />
      <FeedList items={items} viewerId={user?.id} followingEmpty={followingEmpty} />
    </AppPage>
  );
}
