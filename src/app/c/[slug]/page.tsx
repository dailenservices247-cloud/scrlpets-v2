import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { FeedList } from "@/components/feed/FeedList";
import { MessageButton } from "@/components/messaging/MessageButton";
import { CreatureHero } from "@/components/profile/CreatureHero";
import { AnimalRecordsPanel } from "@/components/profile/AnimalRecordsPanel";
import { MemorialSection } from "@/components/creature/MemorialSection";
import { AboutInfoCard } from "@/components/creature/AboutInfoCard";
import { HealthTestsSection } from "@/components/creature/HealthTestsSection";
import { HighlightsSection } from "@/components/highlights/HighlightsSection";
import { LineageSection } from "@/components/creature/LineageSection";
import { AssuranceBadge } from "@/components/anchor/AssuranceBadge";
import { AnchorSection } from "@/components/anchor/AnchorSection";
import { getCreatureBySlug, getCreatureFeed } from "@/lib/profiles/queries";
import { getAnimalRecord } from "@/lib/records/queries";
import { getSessionUser } from "@/lib/auth/session";
import { speciesIdentity } from "@/lib/species/identity";
import { getFeedDestination } from "@/lib/feed/destinations";
import {

  getCreatureDetail,
  getGeneticTests,
  getCreatureParents,
  getCreatureOffspring,
  getLitterName,
  getCreatureAssurance,
  getMyCreatureAnchor,
} from "@/lib/creatures/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const creature = await getCreatureBySlug(slug);
  if (!creature) return {};
  return {
    title: creature.name,
    description: `${creature.name}${creature.species ? ` the ${creature.species}` : ""} on Scrlpets — owned by @${creature.owner.username}.`,
  };
}

export default async function CreaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const creature = await getCreatureBySlug(slug);
  if (!creature) notFound();
  const [items, user, record, detail, tests, parents, offspring, assurance] = await Promise.all([
    getCreatureFeed(creature.id),
    getSessionUser(),
    getAnimalRecord(creature.id),
    getCreatureDetail(creature.id),
    getGeneticTests(creature.id),
    getCreatureParents(creature.id),
    getCreatureOffspring(creature.id),
    getCreatureAssurance(creature.id),
  ]);
  const listing = items.find((item) => item.type === "listing");
  const isOwner = user?.id === creature.ownerId;
  // The definer already refuses everyone but the keeper; the guard just avoids
  // a round trip whose answer is always null.
  // ponytail: sequential rather than folded into the Promise.all above, because
  // it depends on `user` from inside it. One extra RPC on an owner-only render;
  // fold it in if this page ever gets latency-sensitive.
  const anchorValue = isOwner ? await getMyCreatureAnchor(creature.id) : null;
  const isDeceased = !!detail?.deceasedAt;
  const litter = detail?.litterId ? await getLitterName(detail.litterId) : null;
  const t = await getTranslations("creature");
  const tSpecies = await getTranslations("species");
  // A bird lays a clutch, a fish spawns. The word comes from the animal's own
  // species rather than the sentence, so this link never calls a clutch a litter.
  const youngGroup = tSpecies(`youngGroup.${speciesIdentity(creature.species).youngGroup}`);

  return (
    <AppPage>
      <CreatureHero creature={creature} listing={listing} />

      {detail && (
        <MemorialSection
          creatureId={creature.id}
          slug={creature.slug}
          creatureName={creature.name}
          deceasedAt={detail.deceasedAt}
          memorialMessage={detail.memorialMessage}
          isOwner={isOwner}
        />
      )}

      {detail && (
        <AboutInfoCard
          creatureId={creature.id}
          slug={creature.slug}
          detail={detail}
          isOwner={isOwner}
          isDeceased={isDeceased}
        />
      )}

      {/* The identity anchor. The LEVEL is public — it is the honest answer to
          "is this the animal in the photos?" — while the value stays with the
          keeper and everyone else gets a yes/no scan check instead. */}
      {detail && (
        <section className="mx-auto max-w-2xl px-4 pt-4" data-testid="creature-assurance">
          <div className="premium-panel rounded-2xl border p-4">
            <h2 className="eyebrow">{t("assurance.title")}</h2>
            <div className="mt-2">
              <AssuranceBadge level={assurance} anchorType={detail.anchorType} />
            </div>
            <AnchorSection
              creatureId={creature.id}
              slug={creature.slug}
              anchorType={detail.anchorType}
              anchorValue={anchorValue}
              isOwner={isOwner}
              canVerify={!!user && !isOwner}
            />
          </div>
        </section>
      )}

      {/* Visitor actions: a signed-in someone-else gets the two things they
          actually came for. `listing` is the animal's live listing — the feed
          view only returns listings that are not soft-deleted, so its presence
          IS "currently listed" rather than "was listed once".
          ponytail: the banner states the fact and links; price and sale-vs-
          adoption would need a listings read this page does not do yet. */}
      {user && !isOwner && (
        <section
          className="mx-auto max-w-2xl px-4 pt-3"
          data-testid="creature-visitor-actions"
          aria-label={t("visitor.title", { name: creature.name })}
        >
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-medium">{t("visitor.title", { name: creature.name })}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("visitor.messageOwnerHint", { username: creature.owner.username })}
            </p>
            <div className="mt-3">
              <MessageButton profileId={creature.ownerId} />
            </div>
            {listing && (
              <Link
                href={getFeedDestination(listing).href}
                className="mt-4 block rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm transition hover:bg-primary/15"
                data-testid="creature-visitor-listing-banner"
              >
                <span className="block font-medium">
                  {t("visitor.listingBanner", { name: creature.name })}
                </span>
                <span className="mt-1 block text-brand-link underline">
                  {t("visitor.listingCta")}
                </span>
              </Link>
            )}
          </div>
        </section>
      )}

      {litter && (
        <section className="mx-auto max-w-2xl px-4 pt-3" data-testid="creature-litter-link">
          <Link href={`/litters/${litter.id}`} className="text-sm text-brand-link underline">
            {t("fromLitter", { group: youngGroup, name: litter.name })}
          </Link>
        </section>
      )}

      <HighlightsSection
        creatureId={creature.id}
        slug={creature.slug}
        creatureName={creature.name}
        isOwner={isOwner}
        viewerId={user?.id ?? null}
      />

      <HealthTestsSection
        creatureId={creature.id}
        slug={creature.slug}
        tests={tests}
        isOwner={isOwner}
        isDeceased={isDeceased}
      />

      <LineageSection parents={parents} offspring={offspring} isDeceased={isDeceased} />

      <AnimalRecordsPanel
        creatureId={creature.id}
        slug={creature.slug}
        record={record}
        isOwner={isOwner}
      />
      <FeedList items={items} viewerId={user?.id} />
    </AppPage>
  );
}
