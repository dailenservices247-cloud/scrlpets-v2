import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUsernameFor } from "@/lib/profiles/queries";
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
import { getProfilePublicBrands } from "@/lib/brands/queries";
import { getReviewsFor } from "@/lib/reviews/queries";
import { ReviewList } from "@/components/reviews/ReviewList";
import { listProfileServices } from "@/lib/services/queries";
import { listProfileProducts, listRecommendationsForSubject } from "@/lib/shop/queries";
import { ProductCard } from "@/components/shop/ProductCard";
import type { PhotoAlbum, PhotoItem } from "@/components/profile/PhotoGalleryModal";

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
  if (!profile) {
    // A retired handle is retained forever, so an old link resolves to whoever
    // released it rather than 404ing. This is the half of the rename that
    // 20260801171418 called the "link-rot" objection.
    const current = await currentUsernameFor(username);
    if (current) redirect(`/u/${current}`);
    notFound();
  }
  const user = await getSessionUser();
  const active = tab === "pets" || tab === "about" ? tab : "posts";
  // Counts come from the SAME reads the list pages render, so tapping a count
  // can never land on a different number of people than the count promised.
  const [creatures, profileFeed, ownedBrands, followers, following, reviews, services, products, recommendations] =
    await Promise.all([
      getCreaturesByOwner(profile.id),
      getProfileFeed(profile.id),
      getProfilePublicBrands(profile.id),
      getFollowList(profile.id, "followers"),
      getFollowList(profile.id, "following"),
      getReviewsFor(profile.id),
      listProfileServices(profile.id),
      listProfileProducts(profile.id),
      listRecommendationsForSubject({ recommenderId: profile.id }),
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

  // User Photo Albums: Profile Pictures, Cover Photos, and Personal Timeline Posts
  // (Animals and Brands have their own separate, dedicated albums on their respective profiles).
  const userAlbums: PhotoAlbum[] = [];

  if (profile.avatarUrl) {
    userAlbums.push({
      id: "profile_pictures",
      title: "Profile Pictures",
      description: "Personal profile photos",
      photos: [
        {
          url: profile.avatarUrl,
          title: `${profile.displayName ?? profile.username}'s profile picture`,
          subtitle: "Profile Picture",
          albumId: "profile_pictures",
          albumTitle: "Profile Pictures",
        },
      ],
    });
  }

  if (profile.coverUrl) {
    userAlbums.push({
      id: "cover_photos",
      title: "Cover Photos",
      description: "Profile banner and header photos",
      photos: [
        {
          url: profile.coverUrl,
          title: `${profile.displayName ?? profile.username}'s cover photo`,
          subtitle: "Cover Photo",
          albumId: "cover_photos",
          albumTitle: "Cover Photos",
        },
      ],
    });
  }

  // Personal timeline posts only (posts without an attached animal or brand)
  const personalPostsPhotos: PhotoItem[] = [];
  for (const item of profileFeed) {
    if (!item.creature && !item.brand && item.mediaUrl) {
      if (!personalPostsPhotos.some((p) => p.url === item.mediaUrl)) {
        personalPostsPhotos.push({
          url: item.mediaUrl,
          title: item.title ?? "Personal update photo",
          subtitle: item.type.charAt(0).toUpperCase() + item.type.slice(1),
          albumId: "timeline",
          albumTitle: "Personal Posts",
        });
      }
    }
  }

  if (personalPostsPhotos.length > 0) {
    userAlbums.push({
      id: "timeline",
      title: "Personal Posts",
      description: "Photos from personal posts and updates",
      photos: personalPostsPhotos,
    });
  }

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
          albums={userAlbums}
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
          {(services.length > 0 || products.length > 0) && (
            <section className="px-3 pt-3" data-testid="profile-offerings-section">
              <div className="premium-panel rounded-2xl p-4">
                <p className="eyebrow">{t("offeringsEyebrow")}</p>
                {services.length > 0 && (
                  <div className="mt-2" data-testid="profile-services-list">
                    <h2 className="text-sm font-semibold">{t("servicesTitle")}</h2>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {services.map((svc) => (
                        <li key={svc.id}>
                          <Link
                            href={`/services/${svc.id}`}
                            className="block rounded-xl border border-border/70 bg-muted/30 p-3 text-sm transition hover:border-primary/40"
                          >
                            <span className="block truncate font-semibold">{svc.name}</span>
                            {svc.category && (
                              <span className="mt-0.5 block text-xs capitalize text-muted-foreground">
                                {svc.category}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {products.length > 0 && (
                  <div className="mt-4" data-testid="profile-supplies-list">
                    <h2 className="mb-2 text-sm font-semibold">{t("suppliesTitle")}</h2>
                    <div className="grid grid-cols-2 gap-2.5">
                      {products.map((p) => (
                        <ProductCard key={p.id} product={p} />
                      ))}
                    </div>
                  </div>
                )}
                {recommendations.length > 0 && (
                  <div className="mt-4" data-testid="profile-recommendations-list">
                    <h2 className="mb-2 text-sm font-semibold">Recommended Supplies &amp; Gear</h2>
                    <div className="grid grid-cols-2 gap-2.5">
                      {recommendations.map((p) => (
                        <ProductCard key={p.id} product={p} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
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
