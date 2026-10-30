import { notFound } from "next/navigation";
import Link from "next/link";
import { Building2, CalendarClock } from "lucide-react";
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
import { ProductCard } from "@/components/shop/ProductCard";
import { getCreatureBySlug, getCreatureFeed } from "@/lib/profiles/queries";
import { getAnimalRecord } from "@/lib/records/queries";
import { getSessionUser } from "@/lib/auth/session";
import { speciesIdentity } from "@/lib/species/identity";
import { getFeedDestination } from "@/lib/feed/destinations";
import { computeGoHomeTimeline } from "@/lib/creatures/go-home";
import { listBrandServices, listProfileServices } from "@/lib/services/queries";
import { listBrandProducts, listProfileProducts, listRecommendationsForSubject } from "@/lib/shop/queries";
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
  const [items, user, record, detail, tests, parents, offspring, assurance, origin] =
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
    ]);
  const [establishmentServices, establishmentProducts, recommendedProducts] = await Promise.all([
    origin?.brandId
      ? listBrandServices(origin.brandId, creature.ownerId)
      : listProfileServices(creature.ownerId),
    origin?.brandId
      ? listBrandProducts(origin.brandId)
      : listProfileProducts(creature.ownerId),
    listRecommendationsForSubject({ creatureId: creature.id }),
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

      {(origin?.brandSlug || establishmentServices.length > 0 || establishmentProducts.length > 0) && (
        <section
          className="mx-auto max-w-2xl px-4 pt-4"
          data-testid="creature-establishment-panel"
        >
          <div className="premium-panel rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">{t("establishment.eyebrow")}</p>
                <h2 className="mt-1 truncate text-base font-semibold">
                  {origin?.brandName ?? `@${creature.owner.username}`}
                </h2>
              </div>
              {origin?.brandSlug && (
                <Link
                  href={`/b/${origin.brandSlug}`}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-input px-3 text-xs font-medium text-brand-link hover:underline"
                  data-testid="creature-visit-establishment"
                >
                  <Building2 className="size-3.5" aria-hidden />
                  {t("establishment.visitCta")}
                </Link>
              )}
            </div>

            {establishmentServices.length > 0 && (
              <div className="mt-4" data-testid="creature-establishment-services">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("establishment.servicesLabel")}
                </p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {establishmentServices.slice(0, 4).map((svc) => (
                    <li key={svc.id}>
                      <Link
                        href={`/services/${svc.id}`}
                        className="block rounded-xl border border-border/70 bg-muted/30 p-2.5 text-sm transition hover:border-primary/40"
                      >
                        <span className="block truncate font-medium">{svc.name}</span>
                        {svc.category && (
                          <span className="mt-0.5 block text-xs text-muted-foreground capitalize">
                            {svc.category}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {establishmentProducts.length > 0 && (
              <div className="mt-4" data-testid="creature-establishment-supplies">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t("establishment.suppliesLabel")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {establishmentProducts.slice(0, 4).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
            )}

            {recommendedProducts.length > 0 && (
              <div className="mt-4" data-testid="creature-recommended-supplies">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Recommended Go-Home Supplies &amp; Gear
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {recommendedProducts.slice(0, 4).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
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
