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
import { Card } from "@/components/ui/card";

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
  const creatures = await getCreaturesByOwner(profile.id);

  return (
    <main>
      <div className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <ProfileHeader
          profile={profile}
          isOwn={user?.id === profile.id}
          viewerSignedIn={!!user}
        />
        <AnimalRail creatures={creatures} />
        <div className="px-3 pb-3 pt-3">
          <ProfileTabs />
        </div>
      </div>

      {active === "posts" && <FeedList items={await getProfileFeed(profile.id)} />}

      {active === "pets" && (
        <div className="flex flex-col gap-3 p-3" data-testid="pets-list">
          {creatures.map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`}>
              <Card className="flex flex-row items-center gap-3 p-4">
                {c.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatar_url} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span aria-hidden>🐾</span>
                )}
                <span className="font-medium">{c.name}</span>
                {c.species && <span className="text-sm text-muted-foreground">{c.species}</span>}
              </Card>
            </Link>
          ))}
          {creatures.length === 0 && (
            <p className="p-6 text-muted-foreground">{t("noPets")}</p>
          )}
        </div>
      )}

      {active === "about" && (
        <div className="p-4" data-testid="about-panel">
          <p className="whitespace-pre-wrap">{profile.bio ?? t("noBio")}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("memberSince", { date: new Date(profile.createdAt).toLocaleDateString("en-US") })}
          </p>
        </div>
      )}
    </main>
  );
}
