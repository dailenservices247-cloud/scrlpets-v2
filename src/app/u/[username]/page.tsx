import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  getProfileByUsername,
  getProfileFeed,
  getCreaturesByOwner,
} from "@/lib/profiles/queries";
import { AnimalRail } from "@/components/profile/AnimalRail";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { FeedList } from "@/components/feed/FeedList";
import { AppPage } from "@/components/app/AppPage";
import { Card } from "@/components/ui/card";
import type { FeedItem } from "@/lib/feed/types";

function countType(items: FeedItem[], types: FeedItem["type"][]) {
  return items.filter((item) => types.includes(item.type)).length;
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const t = await getTranslations("profile");
  const { username } = await params;
  const { tab } = await searchParams;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const user = await getSessionUser();
  const active = tab === "pets" || tab === "about" ? tab : "posts";
  const [creatures, profileFeed] = await Promise.all([
    getCreaturesByOwner(profile.id),
    getProfileFeed(profile.id),
  ]);
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
          metrics={metrics}
        />
        <AnimalRail creatures={creatures} />
        <div className="px-3 pt-3">
          <ProfileTabs />
        </div>
      </div>

      {active === "posts" && <FeedList items={profileFeed} showTabs={false} />}

      {active === "pets" && (
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
