import { notFound } from "next/navigation";
import { FeedDestinationShell } from "@/components/feed/FeedDestinationShell";
import { ListingInquiryPanel } from "@/components/marketplace/ListingInquiryPanel";
import { ApplyPanel } from "@/components/marketplace/ApplyPanel";
import { ProductDetails } from "@/components/marketplace/ProductDetails";
import { getOpenApplication } from "@/lib/applications/queries";
import { isPaymentsEnabled } from "@/lib/orders/queries";
import { getFeedItemById } from "@/lib/feed/query";
import { getSessionUser } from "@/lib/auth/session";
import { getBrandRole } from "@/lib/brands/queries";
import { getListingMarketplaceDetail } from "@/lib/marketplace/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getFeedItemById(id);
  if (!item || item.type !== "listing") return {};
  const seller = item.brand?.name ?? `@${item.author.username}`;
  return {
    title: item.title ?? "Listing",
    description: `Listing by ${seller} on Scrlpets.`,
  };
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, user, marketplace, paymentsEnabled] = await Promise.all([
    getFeedItemById(id),
    getSessionUser(),
    getListingMarketplaceDetail(id),
    isPaymentsEnabled(),
  ]);
  if (!item || item.type !== "listing" || !marketplace) notFound();
  const openApplication = user
    ? await getOpenApplication(marketplace.sellerId, marketplace.id)
    : null;
  const viewerIsOperator = Boolean(
    user &&
      item.brand &&
      (await getBrandRole(user.id, item.brand.id)),
  );

  return (
    <FeedDestinationShell item={item} viewerId={user?.id}>
      <ProductDetails listing={marketplace} />
      <ListingInquiryPanel
        listingId={marketplace.id}
        sellerId={marketplace.sellerId}
        priceCents={marketplace.priceCents}
        viewerId={user?.id}
        viewerIsOperator={viewerIsOperator}
      />
      <ApplyPanel
        sellerId={marketplace.sellerId}
        listingId={marketplace.id}
        viewerId={user?.id}
        viewerIsSeller={user?.id === marketplace.sellerId}
        hasOpenApplication={Boolean(openApplication)}
        paymentsEnabled={paymentsEnabled}
      />
    </FeedDestinationShell>
  );
}
