import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getFeed, type FeedTab } from "@/lib/feed/query";
import { shouldPromptFirstLitter } from "@/lib/litters/queries";

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
  const t = await getTranslations("litters");
  const user = await getSessionUser(); // null = guest (feed is public per G1-A); seam stays federation-ready
  const { tab } = await searchParams;
  const feedTab: FeedTab = tab === "for_you" ? "for_you" : "following";
  const [items, profile, promptFirstLitter] = await Promise.all([
    getFeed(feedTab, user?.id),
    user ? getProfileById(user.id) : Promise.resolve(null),
    // Deliberately not tied to the feed being empty: a breeder who has set up
    // but published nothing still needs the nudge on a feed full of other
    // people's posts. The condition is their state, not the feed's.
    user ? shouldPromptFirstLitter(user.id) : Promise.resolve(false),
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
      {promptFirstLitter && (
        <section className="px-3 pt-4" data-testid="first-litter-prompt">
          <div className="premium-panel rounded-2xl p-4">
            <p className="eyebrow">{t("promptTitle")}</p>
            <p className="mt-1 text-body">{t("promptBody")}</p>
            <Link
              href="/litters"
              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary/15 px-4 text-sm font-semibold text-brand-link transition hover:bg-primary/25"
            >
              {t("promptCta")}
            </Link>
          </div>
        </section>
      )}
      <FeedList items={items} viewerId={user?.id} followingEmpty={followingEmpty} />
    </AppPage>
  );
}
