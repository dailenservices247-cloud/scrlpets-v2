import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { FeedList } from "@/components/feed/FeedList";
import { BrandProfileHeader } from "@/components/profile/BrandProfileHeader";
import { getSessionUser } from "@/lib/auth/session";
import { getBrandBySlug } from "@/lib/brands/queries";
import { BRAND_TYPE_OPTIONS } from "@/lib/brands/types";
import { getBrandFeed } from "@/lib/feed/query";
import { getProfileById } from "@/lib/profiles/queries";
import type { FeedItem } from "@/lib/feed/types";

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

  const [owner, feed, user] = await Promise.all([
    getProfileById(brand.ownerId),
    getBrandFeed(brand.id),
    getSessionUser(),
  ]);
  if (!owner) notFound();

  const metrics = [
    { label: "Posts", value: countType(feed, ["post", "reel", "long_video"]), testId: "brand-metric-posts" },
    { label: "Listings", value: countType(feed, ["listing"]), testId: "brand-metric-listings" },
  ];

  return (
    <AppPage>
      <div className="border-b border-border/80 bg-background/55 pb-3">
        <BrandProfileHeader
          brand={brand}
          typeLabel={typeLabel(brand.brandType)}
          owner={owner}
          isOwner={user?.id === brand.ownerId}
          metrics={metrics}
        />
      </div>
      <FeedList items={feed} showTabs={false} viewerId={user?.id} />
    </AppPage>
  );
}
