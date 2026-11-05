import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { MessageButton } from "@/components/messaging/MessageButton";
import { CreatureHero } from "@/components/profile/CreatureHero";
import { AnimalRecordsPanel } from "@/components/profile/AnimalRecordsPanel";
import { MemorialSection } from "@/components/creature/MemorialSection";
import { AboutInfoCard } from "@/components/creature/AboutInfoCard";
import { HealthTestsSection } from "@/components/creature/HealthTestsSection";
import { DigitalPassport } from "@/components/creature/DigitalPassport";
import { UniversalCareHabitatCard } from "@/components/care/UniversalCareHabitatCard";
import { HighlightsSection } from "@/components/highlights/HighlightsSection";
import { LineageSection } from "@/components/creature/LineageSection";
import { PedigreeMatrix } from "@/components/creature/PedigreeMatrix";
import { AssuranceBadge } from "@/components/anchor/AssuranceBadge";
import { AnchorSection } from "@/components/anchor/AnchorSection";
import { getCreatureBySlug, getCreatureFeed } from "@/lib/profiles/queries";
import { getAnimalRecord } from "@/lib/records/queries";
import { getSessionUser } from "@/lib/auth/session";
import { speciesIdentity } from "@/lib/species/identity";
import { getFeedDestination } from "@/lib/feed/destinations";
import { computeGoHomeTimeline } from "@/lib/creatures/go-home";
import type { PhotoAlbum, PhotoItem } from "@/components/profile/PhotoGalleryModal";
import {
  getCreatureDetail,
  getGeneticTests,
  getCreatureParents,
  getCreatureOffspring,
  getLitterName,
  getCreatureAssurance,
  getMyCreatureAnchor,
  getCreatureOriginAttribution,
} from "@/lib/creatures/queries";
import { getCreaturePedigree } from "@/lib/creatures/pedigree";
import { getMyBrands } from "@/lib/brands/queries";

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
  const [items, user, record, detail, tests, parents, offspring, assurance, origin, pedigree] =
    await Promise.all([
      getCreatureFeed(creature.id),
      getSessionUser(),
      getAnimalRecord(creature.id),
      getCreatureDetail(creature.id),
      getGeneticTests(creature.id),
      getCreatureParents(creature.id),
      getCreatureOffspring(creature.id),
      getCreatureAssurance(creature.id),
      getCreatureOriginAttribution(creature.id),
      getCreaturePedigree(creature.id),
    ]);
  const listing = items.find((item) => item.type === "listing");
  const isOwner = user?.id === creature.ownerId;
  const userBrands = isOwner && user ? await getMyBrands(user.id) : [];
  const hasBrandAccess = userBrands.length > 0;
  // The definer already refuses everyone but the keeper; the guard just avoids
  // a round trip whose answer is always null.
  // ponytail: sequential rather than folded into the Promise.all above, because
  // it depends on `user` from inside it. One extra RPC on an owner-only render;
  // fold it in if this page ever gets latency-sensitive.
  const anchorValue = isOwner ? await getMyCreatureAnchor(creature.id) : null;
  const isDeceased = !!detail?.deceasedAt;
  const goHome = !isDeceased
    ? computeGoHomeTimeline(creature.species, detail?.birthDate)
    : null;
  const litter = detail?.litterId ? await getLitterName(detail.litterId) : null;
  const t = await getTranslations("creature");
  const tSpecies = await getTranslations("species");
  // A bird lays a clutch, a fish spawns. The word comes from the animal's own
  // species rather than the sentence, so this link never calls a clutch a litter.
  const youngGroup = tSpecies(`youngGroup.${speciesIdentity(creature.species).youngGroup}`);

  // Animal Photo Albums: Profile Pictures and Animal Updates
  // (Strictly isolated to THIS animal — no human owner photos, no other animals)
  const creatureAlbums: PhotoAlbum[] = [];

  if (creature.avatarUrl) {
    creatureAlbums.push({
      id: "profile_pictures",
      title: "Profile Pictures",
      description: `${creature.name}'s profile photo`,
      photos: [
        {
          url: creature.avatarUrl,
          title: `${creature.name}'s profile picture`,
          subtitle: "Profile Picture",
          albumId: "profile_pictures",
          albumTitle: "Profile Pictures",
        },
      ],
    });
  }

  const creatureUpdatesPhotos: PhotoItem[] = [];
  for (const item of items) {
    if (item.mediaUrl && !creatureUpdatesPhotos.some((p) => p.url === item.mediaUrl)) {
      creatureUpdatesPhotos.push({
        url: item.mediaUrl,
        title: item.title ?? `${creature.name}'s update photo`,
        subtitle: item.type.charAt(0).toUpperCase() + item.type.slice(1),
        albumId: "creature_updates",
        albumTitle: `${creature.name}'s Updates`,
      });
    }
  }

  if (creatureUpdatesPhotos.length > 0) {
    creatureAlbums.push({
      id: "creature_updates",
      title: `${creature.name}'s Updates`,
      description: `Photos and media for ${creature.name}`,
      photos: creatureUpdatesPhotos,
    });
  }

  return (
    <AppPage>
      <CreatureHero
        creature={creature}
        listing={listing}
        origin={origin}
        isOwner={isOwner}
        albums={creatureAlbums}
      />

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
          userId={user?.id ?? ""}
          detail={detail}
          isOwner={isOwner}
          isDeceased={isDeceased}
          hasBrandAccess={hasBrandAccess}
        />
      )}

      {goHome && goHome.minAgeWeeks > 0 && (
        <section
          className="mx-auto max-w-2xl px-4 pt-3"
          data-testid="creature-go-home-timeline"
        >
          <div className="premium-panel flex items-start gap-3 rounded-2xl border p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-secondary/40 bg-secondary/15 text-secondary-foreground">
              <CalendarClock className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">{t("goHome.eyebrow")}</p>
              <p className="mt-1 text-sm font-medium">
                {goHome.isReadyToGoHome
                  ? t("goHome.readyNow", { weeks: goHome.ageWeeks })
                  : t("goHome.eligibleOn", {
                      date: goHome.eligibleGoHomeDate,
                      days: goHome.daysUntilReady,
                    })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("goHome.ruleHint", { minWeeks: goHome.minAgeWeeks })}
              </p>
            </div>
          </div>
        </section>
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
              <MessageButton profileId={creature.ownerId} creatureId={creature.id} />
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

      <DigitalPassport
        creatureName={creature.name}
        species={creature.species}
        subtype={detail?.breed}
        gender={detail?.gender}
        birthOrHatchDate={detail?.birthDate}
        registrationNumber={detail?.registrationNumber}
        anchorType={detail?.anchorType}
        anchorVerified={assurance !== "declared"}
        ownerUsername={creature.owner.username}
        brandName={origin?.brandName}
      />

      <UniversalCareHabitatCard
        creatureId={creature.id}
        species={creature.species}
        creatureName={creature.name}
      />

      <HealthTestsSection
        creatureId={creature.id}
        slug={creature.slug}
        tests={tests}
        isOwner={isOwner}
        isDeceased={isDeceased}
      />

      {pedigree && <PedigreeMatrix data={pedigree} />}

      <LineageSection parents={parents} offspring={offspring} isDeceased={isDeceased} />

      <AnimalRecordsPanel
        creatureId={creature.id}
        slug={creature.slug}
        record={record}
        isOwner={isOwner}
      />
    </AppPage>
  );
}
