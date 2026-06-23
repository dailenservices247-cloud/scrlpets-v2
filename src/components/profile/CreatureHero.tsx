import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { FeedItem } from "@/lib/feed/types";
import type { CreatureProfile } from "@/lib/profiles/queries";
import { getFeedDestination } from "@/lib/feed/destinations";

export async function CreatureHero({
  creature,
  listing,
}: {
  creature: CreatureProfile;
  listing: FeedItem | undefined;
}) {
  const t = await getTranslations("detail");

  return (
    <section
      className="border-b bg-card px-4 py-5"
      data-testid="creature-header"
      aria-labelledby="creature-hero-title"
    >
      <div className="mx-auto flex max-w-2xl gap-4">
        {creature.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creature.avatarUrl}
            alt=""
            width={88}
            height={88}
            className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-border"
          />
        ) : (
          <span
            className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-secondary text-3xl text-secondary-foreground"
            aria-hidden
          >
            {creature.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{t("animalProfile")}</p>
          <h1 id="creature-hero-title" className="truncate text-2xl font-bold">
            {creature.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {creature.species && (
              <span className="rounded-md border border-secondary/40 bg-secondary/15 px-2 py-1 text-secondary-foreground">
                {creature.species}
              </span>
            )}
            <Link href={`/u/${creature.owner.username}`} className="text-brand-link underline">
              @{creature.owner.username}
            </Link>
          </div>
          {listing && (
            <Link
              href={getFeedDestination(listing).href}
              className="mt-4 inline-flex min-h-10 items-center rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="creature-listing-cue"
            >
              {t("listingActivity")}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
