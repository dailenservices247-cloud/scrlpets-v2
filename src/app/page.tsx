import { getFeed, type FeedTab } from "@/lib/feed/query";
import { getSessionUser } from "@/lib/auth/session";
import { FeedList } from "@/components/feed/FeedList";
import { AppHeader } from "@/components/app/AppHeader";
import { AppPage } from "@/components/app/AppPage";
import { FeedComposerPrompt } from "@/components/feed/FeedComposerPrompt";
import { UpdatesMomentsRail } from "@/components/feed/UpdatesMomentsRail";
import { getProfileById } from "@/lib/profiles/queries";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser(); // null = guest (feed is public per G1-A); seam stays federation-ready
  const { tab } = await searchParams;
  const feedTab: FeedTab = tab === "for_you" ? "for_you" : "following";
  const [items, profile] = await Promise.all([
    getFeed(feedTab),
    user ? getProfileById(user.id) : Promise.resolve(null),
  ]);
  return (
    <AppPage>
      <AppHeader signedIn={Boolean(user)} />
      <FeedComposerPrompt
        signedIn={Boolean(user)}
        avatarUrl={profile?.avatarUrl}
        fallbackLabel={profile?.displayName ?? profile?.username ?? user?.email}
      />
      <UpdatesMomentsRail items={items} signedIn={Boolean(user)} />
      <FeedList items={items} />
    </AppPage>
  );
}
