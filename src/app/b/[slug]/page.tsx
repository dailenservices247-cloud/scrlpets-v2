import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { FeedList } from "@/components/feed/FeedList";
import { BrandProfileHeader } from "@/components/profile/BrandProfileHeader";
import { BrandGalleryStrip } from "./BrandGalleryStrip";
import { getSessionUser } from "@/lib/auth/session";
import {
  getBrandBySlug,
  getBrandRole,
  getPublicBrandTeam,
  listBrandCreatures,
  listBrandLitters,
} from "@/lib/brands/queries";
import { BRAND_TYPE_OPTIONS } from "@/lib/brands/types";
import { getBrandFeed } from "@/lib/feed/query";
import { listBrandProducts } from "@/lib/shop/queries";
import { listBrandServices } from "@/lib/services/queries";
import { ProductCard } from "@/components/shop/ProductCard";
import { getProfileById } from "@/lib/profiles/queries";
import { getBrandKit, getBrandGallery } from "@/lib/brand-kit/queries";
import type { FeedItem } from "@/lib/feed/types";
import type { PhotoAlbum, PhotoItem } from "@/components/profile/PhotoGalleryModal";

export const dynamic = "force-dynamic";


function countType(items: FeedItem[], types: FeedItem["type"][]) {
  return items.filter((item) => types.includes(item.type)).length;
}

function typeLabel(value: string): string {
  return BRAND_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? "Brand";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) return {};
  return {
    title: brand.name,
    description: `${brand.name} — ${typeLabel(brand.brandType)} on Scrlpets.`,
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  const user = await getSessionUser();
  const [owner, feed, role, products, kit, gallery, team, creatures, litters, services] =
    await Promise.all([
      getProfileById(brand.ownerId),
      getBrandFeed(brand.id),
      user ? getBrandRole(user.id, brand.id) : Promise.resolve(null),
      listBrandProducts(brand.id),
      getBrandKit(brand.id),
      getBrandGallery(brand.id),
      getPublicBrandTeam(brand.id),
      listBrandCreatures(brand.ownerId),
      listBrandLitters(brand.id, brand.ownerId),
      listBrandServices(brand.id, brand.ownerId),
    ]);
  if (!owner) notFound();

  const metrics = [
    { label: "Posts", value: countType(feed, ["post", "reel", "long_video"]), testId: "brand-metric-posts" },
    { label: "Listings", value: countType(feed, ["listing"]), testId: "brand-metric-listings" },
  ];
  const t = await getTranslations("brandKit");
  const foundedYear = kit.foundedOn ? new Date(kit.foundedOn).getFullYear() : null;
  const hasAbout = !!(kit.tagline || foundedYear || kit.philosophy || kit.yearsExperience !== null || kit.specialties.length > 0);
  const peopleRunning =
    team.length > 0
      ? team
      : [
          {
            profileId: owner.id,
            username: owner.username,
            displayName: owner.displayName,
            avatarUrl: owner.avatarUrl,
            role: "owner" as const,
            isVerified: false,
          },
        ];

  // Brand Photo Albums: Logos, Banners, Facility Gallery, and Brand Posts
  const brandAlbums: PhotoAlbum[] = [];

  if (brand.avatarUrl) {
    brandAlbums.push({
      id: "brand_logos",
      title: "Logos & Emblems",
      description: `${brand.name}'s logos`,
      photos: [
        {
          url: brand.avatarUrl,
          title: `${brand.name} Logo`,
          subtitle: "Brand Logo",
          albumId: "brand_logos",
          albumTitle: "Logos & Emblems",
        },
      ],
    });
  }

  if (brand.bannerUrl) {
    brandAlbums.push({
      id: "brand_banners",
      title: "Banners & Headers",
      description: `${brand.name}'s banner photos`,
      photos: [
        {
          url: brand.bannerUrl,
          title: `${brand.name} Banner`,
          subtitle: "Brand Banner",
          albumId: "brand_banners",
          albumTitle: "Banners & Headers",
        },
      ],
    });
  }

  if (gallery.length > 0) {
    brandAlbums.push({
      id: "facility_gallery",
      title: "Facility Gallery",
      description: "Facility photos, grounds, and premises",
      photos: gallery.map((g) => ({
        url: g.photoUrl,
        title: g.caption ?? `${brand.name} facility photo`,
        subtitle: "Facility Gallery",
        albumId: "facility_gallery",
        albumTitle: "Facility Gallery",
      })),
    });
  }

  const brandPostPhotos: PhotoItem[] = [];
  for (const item of feed) {
    if (item.mediaUrl && !brandPostPhotos.some((p) => p.url === item.mediaUrl)) {
      brandPostPhotos.push({
        url: item.mediaUrl,
        title: item.title ?? `${brand.name} update photo`,
        subtitle: item.type.charAt(0).toUpperCase() + item.type.slice(1),
        albumId: "brand_posts",
        albumTitle: "Brand Updates",
      });
    }
  }

  if (brandPostPhotos.length > 0) {
    brandAlbums.push({
      id: "brand_posts",
      title: "Brand Updates",
      description: `Official posts from ${brand.name}`,
      photos: brandPostPhotos,
    });
  }

  return (
    <AppPage>
      <div className="border-b border-border/80 bg-background/55 pb-3">
        <BrandProfileHeader
          brand={brand}
          typeLabel={typeLabel(brand.brandType)}
          owner={owner}
          canOperate={role !== null}
          metrics={metrics}
          albums={brandAlbums}
        />
      </div>

      {hasAbout && (
        <section className="px-3 pt-3" data-testid="brand-about-panel">
          {/* Already the panel register (§3.3) — the type inside it now
              reads off the one scale too. */}
          <div className="premium-panel rounded-2xl p-4">
            {kit.tagline && (
              <p className="text-body italic text-muted-foreground" data-testid="brand-tagline">
                {kit.tagline}
              </p>
            )}
            {foundedYear && (
              <p className="mt-1 text-meta text-muted-foreground" data-testid="brand-established">
                {t("establishedLabel", { year: foundedYear })}
              </p>
            )}
            {kit.philosophy && (
              <blockquote
                className="mt-3 border-l-2 border-accent/40 pl-3 text-body italic text-foreground/90"
                data-testid="brand-philosophy"
              >
                {kit.philosophy}
              </blockquote>
            )}
            {kit.yearsExperience !== null && (
              <p className="mt-3 text-ui font-medium" data-testid="brand-years-experience">
                {t("yearsExperiencePublic", { years: kit.yearsExperience })}
              </p>
            )}
            {kit.specialties.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2" data-testid="brand-specialties">
                {kit.specialties.map((s) => (
                  <li key={s} className="rounded-full border border-border/70 bg-muted/35 px-3 py-1 text-meta">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* People running this establishment — clickable cards to each person's /u/[username] */}
      <section className="px-3 pt-3" data-testid="brand-team-section">
        <div className="premium-panel rounded-2xl p-4">
          <p className="eyebrow">{t("peopleEyebrow")}</p>
          <h2 className="mt-1 font-serif text-title">{t("peopleTitle")}</h2>
          <p className="mt-1 text-meta text-muted-foreground">{t("peopleSubtitle")}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="brand-team-list">
            {peopleRunning.map((person) => (
              <li key={person.profileId}>
                <Link
                  href={`/u/${person.username}`}
                  data-testid={`brand-team-member-${person.username}`}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 transition hover:border-primary/40 hover:bg-muted/45"
                >
                  {person.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.avatarUrl}
                      alt=""
                      width={44}
                      height={44}
                      className="size-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary/20 text-ui font-semibold text-secondary-foreground"
                      aria-hidden
                    >
                      {(person.displayName ?? person.username).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-ui font-semibold">
                        {person.displayName ?? person.username}
                      </span>
                      {person.isVerified && (
                        <ShieldCheck
                          className="size-4 shrink-0 text-secondary-foreground"
                          aria-label={t("verifiedMember")}
                        />
                      )}
                    </div>
                    <span className="block truncate text-meta text-brand-link">
                      @{person.username}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full border border-border/70 bg-muted/45 px-2.5 py-0.5 text-micro capitalize text-muted-foreground">
                    {t(`role.${person.role}`)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <BrandGalleryStrip photos={gallery} />

      {/* Establishment Animals & Litters + Family Tree link */}
      {(creatures.length > 0 || litters.length > 0) && (
        <section className="px-3 pt-3" data-testid="brand-animals-section">
          <div className="premium-panel rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="eyebrow">{t("animalsEyebrow")}</p>
                <h2 className="mt-1 font-serif text-title">{t("animalsTitle")}</h2>
              </div>
              <Link
                href={`/u/${owner.username}/tree`}
                data-testid="brand-family-tree-link"
                className="inline-flex min-h-10 items-center rounded-xl border border-input px-3 text-meta font-medium text-brand-link hover:underline"
              >
                {t("viewFamilyTree")}
              </Link>
            </div>

            {creatures.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3" data-testid="brand-creatures-grid">
                {creatures.map((c) => (
                  <Link
                    key={c.id}
                    href={`/c/${c.slug}`}
                    className="rounded-xl border border-border/70 bg-muted/30 p-2.5 transition hover:border-primary/40"
                  >
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.avatarUrl}
                        alt=""
                        width={160}
                        height={128}
                        className="aspect-[5/4] w-full rounded-lg object-cover"
                      />
                    ) : (
                      <span
                        className="grid aspect-[5/4] w-full place-items-center rounded-lg bg-secondary/20 text-title font-semibold text-secondary-foreground"
                        aria-hidden
                      >
                        {c.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="mt-2 block truncate text-ui font-semibold">{c.name}</span>
                    <span className="block truncate text-meta text-muted-foreground">
                      {c.breed ?? c.species ?? ""}
                    </span>
                    {c.deceasedAt && (
                      <span
                        className="mt-1 inline-block rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-micro font-medium text-foreground"
                        data-testid={`brand-creature-memorial-${c.slug}`}
                      >
                        {t("memorialBadge")}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}

            {litters.length > 0 && (
              <div className="mt-4" data-testid="brand-litters-list">
                <p className="text-meta font-medium text-muted-foreground">{t("littersSubtitle")}</p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {litters.map((litter) => (
                    <li key={litter.id}>
                      <Link
                        href={`/litters/${litter.id}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 transition hover:border-primary/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-ui font-semibold">{litter.name}</span>
                          <span className="block truncate text-meta text-muted-foreground">
                            {[litter.species, litter.breed].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full border border-border/70 px-2.5 py-0.5 text-micro capitalize text-muted-foreground">
                          {litter.status}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Establishment Services */}
      {services.length > 0 && (
        <section className="px-3 pt-3" data-testid="brand-services-section">
          <div className="premium-panel rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="eyebrow">{t("servicesEyebrow")}</p>
                <h2 className="mt-1 font-serif text-title">{t("servicesTitle")}</h2>
              </div>
              <Link
                href="/market?tab=services"
                className="text-meta font-medium text-brand-link hover:underline"
              >
                Browse All Services →
              </Link>
            </div>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {services.map((svc) => (
                <li key={svc.id}>
                  <Link
                    href={`/services/${svc.id}`}
                    className="flex gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 transition hover:border-primary/40 hover:bg-muted/45"
                  >
                    {svc.mediaUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={svc.mediaUrl}
                        alt=""
                        width={80}
                        height={80}
                        className="size-20 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="block truncate text-ui font-semibold text-foreground">{svc.name}</span>
                        {svc.priceCents !== null && (
                          <span className="shrink-0 font-mono text-meta font-bold text-foreground">
                            ${Math.round(svc.priceCents / 100).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {svc.category && (
                        <span className="mt-0.5 block text-meta capitalize text-muted-foreground">
                          {svc.category}
                        </span>
                      )}
                      {svc.area && (
                        <span className="mt-1 block truncate text-micro text-muted-foreground">
                          📍 {svc.area}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section className="px-4 py-5" data-testid="brand-shop">
          <h2 className="pb-3 font-serif text-display">Shop</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
      <FeedList items={feed} showTabs={false} viewerId={user?.id} />
    </AppPage>
  );
}
