import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { FeedList } from "@/components/feed/FeedList";
import { AnimalRail } from "@/components/profile/AnimalRail";
import { BrandProfileHeader, BrandRelationshipPanel } from "@/components/profile/BrandProfileHeader";
import { getBrandSurfaceBySlug } from "@/lib/profile-identity";
import { getCreaturesByOwner, getProfileByUsername, getProfileFeed } from "@/lib/profiles/queries";
import type { FeedItem } from "@/lib/feed/types";

function countType(items: FeedItem[], types: FeedItem["type"][]) {
  return items.filter((item) => types.includes(item.type)).length;
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = getBrandSurfaceBySlug(slug);
  if (!brand) notFound();

  const owner = await getProfileByUsername(brand.ownerUsername);
  if (!owner) notFound();

  const [creatures, feed] = await Promise.all([
    getCreaturesByOwner(owner.id),
    getProfileFeed(owner.id),
  ]);

  const metrics = [
    { label: "Animals", value: creatures.length, testId: "brand-metric-animals" },
    { label: "Listings", value: countType(feed, ["listing"]), testId: "brand-metric-listings" },
    { label: "Pack", value: brand.packCount, testId: "brand-metric-pack" },
  ];

  return (
    <AppPage>
      <div className="border-b border-border/80 bg-background/55 pb-3">
        <BrandProfileHeader brand={brand} owner={owner} metrics={metrics} />
        <BrandRelationshipPanel brand={brand} />
        <AnimalRail creatures={creatures} />
      </div>
      <FeedList items={feed} showTabs={false} />
    </AppPage>
  );
}
