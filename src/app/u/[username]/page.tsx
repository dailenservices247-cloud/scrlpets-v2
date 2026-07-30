import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  getProfileByUsername,
  getProfileFeed,
  getCreaturesByOwner,
  getFollowList,
} from "@/lib/profiles/queries";
import { isFollowing, hasBlocked } from "@/lib/social/follows";
import { AnimalRail } from "@/components/profile/AnimalRail";
import { FeedComposerPrompt } from "@/components/feed/FeedComposerPrompt";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileIdentityPanel } from "@/components/profile/ProfileIdentityPanel";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { FeedList } from "@/components/feed/FeedList";
import { AppPage } from "@/components/app/AppPage";
import { Card } from "@/components/ui/card";
import type { FeedItem } from "@/lib/feed/types";
import { getBrandsByOwner } from "@/lib/brands/queries";
import { getReviewsFor } from "@/lib/reviews/queries";
import { ReviewList } from "@/components/reviews/ReviewList";

export const dynamic = "force-dynamic";


function countType(items: FeedItem[], types: FeedItem["type"][]) {
  return items.filter((item) => types.includes(item.type)).length;
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) return {};
  const name = profile.displayName ?? profile.username;
  return {
    title: `${name} (@${profile.username})`,
    description: profile.bio ?? `${name} on Scrlpets — animals, posts, and listings.`,
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const t = await getTranslations("profile");
  const tHub = await getTranslations("hub");
  const { username } = await params;
  const { tab } = await searchParams;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const user = await getSessionUser();
  const active = tab === "pets" || tab === "about" ? tab : "posts";
  // Counts come from the SAME reads the list pages render, so tapping a count
  // can never land on a different number of people than the count promised.
  const [creatures, profileFeed, ownedBrands, followers, following, reviews] =
    await Promise.all([
      getCreaturesByOwner(profile.id),
      getProfileFeed(profile.id),
      getBrandsByOwner(profile.id),
      getFollowList(profile.id, "followers"),
      getFollowList(profile.id, "following"),
      getReviewsFor(profile.id),
    ]);
  const followCounts = { followers: followers.length, following: following.length };
  const [viewerFollowing, viewerBlocked] =
    !!user && user.id !== profile.id
      ? await Promise.all([
          isFollowing(user.id, profile.id),
          hasBlocked(user.id, profile.id),
        ])
      : [false, false];
  const metrics = [
    { label: t("metricAnimals"), value: creatures.length, testId: "metric-animals" },
    { label: t("metricPosts"), value: countType(profileFeed, ["post", "reel", "long_video"]), testId: "metric-posts" },
    { label: t("metricListings"), value: countType(profileFeed, ["listing"]), testId: "metric-listings" },
  ];

  return (
    <AppPage>
      <div className="border-b border-border/80 bg-background/55 pb-3">
        <ProfileHeader
          profile={profile}
          isOwn={user?.id === profile.id}
          viewerSignedIn={!!user}
          viewerFollowing={viewerFollowing}
          viewerBlocked={viewerBlocked}
          followCounts={followCounts}
          metrics={metrics}
        />
        <ProfileIdentityPanel brands={ownedBrands} />
        <AnimalRail creatures={creatures} />
        <div className="px-3 pt-3">
          <ProfileTabs />
        </div>
      </div>

      {active === "posts" && (
        <>
          {/* punch list A1: FB-style — post from your own profile page. */}
          {user?.id === profile.id && (
            <div className="border-b border-border/60 px-3 py-3">
              <FeedComposerPrompt
                signedIn
                avatarUrl={profile.avatarUrl}
                fallbackLabel={profile.displayName ?? profile.username}
              />
            </div>
          )}
          <FeedList items={profileFeed} showTabs={false} viewerId={user?.id} />
          {/* The trust surface that replaced the deleted score: real reviews
              from confirmed handovers, or an honest empty state. */}
          <ReviewList reviews={reviews} />
        </>
      )}

      {active === "pets" && (
        <>
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          <Link
            href={`/u/${profile.username}/tree`}
            data-testid="profile-tree-link"
            className="inline-flex min-h-11 items-center rounded-xl border border-input px-4 text-sm font-medium text-brand-link"
          >
            {t("viewTree")}
          </Link>
          {/* R3 (dedup): owner-only management link, distinct from the public
              showcase "view family tree" link above — don't duplicate that one. */}
          {user?.id === profile.id && (
            <Link
              href="/tree"
              data-testid="profile-manage-tree-link"
              className="inline-flex min-h-11 items-center rounded-xl border border-input px-4 text-sm font-medium text-brand-link"
            >
              {tHub("manageInTree")}
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 p-3" data-testid="pets-list">
          {creatures.map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`} className="focus:outline-none focus:ring-2 focus:ring-ring">
              <Card className="premium-panel h-full gap-3 rounded-2xl p-3">
                {c.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatar_url} alt="" width={180} height={144} className="aspect-[5/4] w-full rounded-xl object-cover" />
                ) : (
                  <span className="grid aspect-[5/4] w-full place-items-center rounded-xl bg-secondary text-2xl text-secondary-foreground" aria-hidden>
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <span className="block truncate text-base font-semibold">{c.name}</span>
                  {c.species && <span className="mt-1 block truncate text-xs text-muted-foreground">{c.species}</span>}
                </div>
              </Card>
            </Link>
          ))}
          {creatures.length === 0 && (
            <p className="col-span-2 rounded-2xl border border-border/70 p-6 text-muted-foreground">{t("noPets")}</p>
          )}
        </div>
        </>
      )}

      {active === "about" && (
        <div className="p-3" data-testid="about-panel">
          <section className="premium-panel rounded-2xl p-4">
            <p className="eyebrow">{t("aboutLabel")}</p>
            <p className="mt-3 whitespace-pre-wrap leading-7">{profile.bio ?? t("noBio")}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
                <dt className="text-xs text-muted-foreground">{t("metricAnimals")}</dt>
                <dd className="mt-1 text-lg font-semibold">{creatures.length}</dd>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
                <dt className="text-xs text-muted-foreground">{t("joined")}</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </AppPage>
  );
}
