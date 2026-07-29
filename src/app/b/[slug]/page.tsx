import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { FeedList } from "@/components/feed/FeedList";
import { BrandProfileHeader } from "@/components/profile/BrandProfileHeader";
import { BrandGalleryStrip } from "./BrandGalleryStrip";
import { getSessionUser } from "@/lib/auth/session";
import { getBrandBySlug, getBrandRole } from "@/lib/brands/queries";
import { BRAND_TYPE_OPTIONS } from "@/lib/brands/types";
import { getBrandFeed } from "@/lib/feed/query";
import { listBrandProducts } from "@/lib/shop/queries";
import { ProductCard } from "@/components/shop/ProductCard";
import { getProfileById } from "@/lib/profiles/queries";
import { getBrandKit, getBrandGallery } from "@/lib/brand-kit/queries";
import type { FeedItem } from "@/lib/feed/types";

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
  const [owner, feed, role, products, kit, gallery] = await Promise.all([
    getProfileById(brand.ownerId),
    getBrandFeed(brand.id),
    user ? getBrandRole(user.id, brand.id) : Promise.resolve(null),
    listBrandProducts(brand.id),
    getBrandKit(brand.id),
    getBrandGallery(brand.id),
  ]);
  if (!owner) notFound();

  const metrics = [
    { label: "Posts", value: countType(feed, ["post", "reel", "long_video"]), testId: "brand-metric-posts" },
    { label: "Listings", value: countType(feed, ["listing"]), testId: "brand-metric-listings" },
  ];
  const t = await getTranslations("brandKit");
  const foundedYear = kit.foundedOn ? new Date(kit.foundedOn).getFullYear() : null;
  const hasAbout = !!(kit.tagline || foundedYear || kit.philosophy || kit.yearsExperience !== null || kit.specialties.length > 0);

  return (
    <AppPage>
      <div className="border-b border-border/80 bg-background/55 pb-3">
        <BrandProfileHeader
          brand={brand}
          typeLabel={typeLabel(brand.brandType)}
          owner={owner}
          canOperate={role !== null}
          metrics={metrics}
        />
      </div>

      {hasAbout && (
        <section className="px-3 pt-3" data-testid="brand-about-panel">
          <div className="premium-panel rounded-2xl p-4">
            {kit.tagline && (
              <p className="text-sm italic text-muted-foreground" data-testid="brand-tagline">
                {kit.tagline}
              </p>
            )}
            {foundedYear && (
              <p className="mt-1 text-xs text-muted-foreground" data-testid="brand-established">
                {t("establishedLabel", { year: foundedYear })}
              </p>
            )}
            {kit.philosophy && (
              <blockquote
                className="mt-3 border-l-2 border-accent/40 pl-3 text-sm italic leading-6 text-foreground/90"
                data-testid="brand-philosophy"
              >
                {kit.philosophy}
              </blockquote>
            )}
            {kit.yearsExperience !== null && (
              <p className="mt-3 text-sm font-medium" data-testid="brand-years-experience">
                {t("yearsExperiencePublic", { years: kit.yearsExperience })}
              </p>
            )}
            {kit.specialties.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2" data-testid="brand-specialties">
                {kit.specialties.map((s) => (
                  <li key={s} className="rounded-full border border-border/70 bg-muted/35 px-3 py-1 text-xs">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <BrandGalleryStrip photos={gallery} />

      {products.length > 0 && (
        <section className="px-4 py-5" data-testid="brand-shop">
          <h2 className="pb-3 text-sm font-semibold">Shop</h2>
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
