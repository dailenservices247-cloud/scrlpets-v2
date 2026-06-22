import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FeedList } from "@/components/feed/FeedList";
import { getFeedDestination } from "@/lib/feed/destinations";
import { getCreatureBySlug, getCreatureFeed } from "@/lib/profiles/queries";

export default async function CreaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const creature = await getCreatureBySlug(slug);
  if (!creature) notFound();
  const items = await getCreatureFeed(creature.id);
  const listing = items.find((item) => item.type === "listing");
  const t = await getTranslations("detail");

  return (
    <main>
      <header
        className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 p-4 backdrop-blur"
        data-testid="creature-header"
      >
        {creature.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creature.avatarUrl} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="text-3xl" aria-hidden>
            🐾
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{creature.name}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {creature.species && <span>{creature.species} · </span>}
            <Link href={`/u/${creature.owner.username}`} className="text-brand-link underline">
              @{creature.owner.username}
            </Link>
          </p>
        </div>
      </header>
      {listing && (
        <div className="border-b p-3" data-testid="creature-listing-cue">
          <Link
            href={getFeedDestination(listing).href}
            className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground transition hover:bg-primary/15"
          >
            <span>{t("listingActivity")}</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}
      <FeedList items={items} />
    </main>
  );
}
