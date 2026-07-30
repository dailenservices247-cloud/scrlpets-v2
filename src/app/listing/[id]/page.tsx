import { notFound } from "next/navigation";
import { FeedDestinationShell } from "@/components/feed/FeedDestinationShell";
import { ListingInquiryPanel } from "@/components/marketplace/ListingInquiryPanel";
import { ApplyPanel } from "@/components/marketplace/ApplyPanel";
import { ProductDetails } from "@/components/marketplace/ProductDetails";
import { PhotoGallery } from "@/components/listing/PhotoGallery";
import { PetDetailsPanel } from "@/components/listing/PetDetailsPanel";
import { VerificationPanel } from "@/components/listing/VerificationPanel";
import { AdoptionHealthPanel } from "@/components/adoption/AdoptionHealthPanel";
import { AdoptionApplicationForm } from "@/components/adoption/AdoptionApplicationForm";
import { getAdoptionDetail } from "@/lib/adoption/queries";
import { getOpenApplication } from "@/lib/applications/queries";
import { isPaymentsEnabled } from "@/lib/orders/queries";
import { getFeedItemById } from "@/lib/feed/query";
import { getSessionUser } from "@/lib/auth/session";
import { getBrandRole } from "@/lib/brands/queries";
import { getListingMarketplaceDetail } from "@/lib/marketplace/queries";
import {
  getListingAnimalDetails,
  getListingPhotos,
  isSellerIdentityVerified,
} from "@/lib/listings/queries";
import { getAttestedCreatureIds } from "@/lib/verification/queries";

export const dynamic = "force-dynamic";


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

  // V2-01/V2-02: gallery, structured pet details, and real verification state.
  const creatureId = item.creature?.id ?? null;
  // V2-03: adoption depth lives on THIS page, not a parallel /adopt/[id] —
  // one listing, one detail surface. Returns null for a sale listing.
  const [photos, animalDetails, sellerVerified, animalAttested, adoption] = await Promise.all([
    getListingPhotos(marketplace.id),
    creatureId ? getListingAnimalDetails(creatureId) : Promise.resolve(null),
    isSellerIdentityVerified(marketplace.sellerId),
    creatureId
      ? getAttestedCreatureIds([creatureId]).then((ids) => ids.has(creatureId))
      : Promise.resolve(false),
    getAdoptionDetail(marketplace.id),
  ]);
  const viewerIsSeller = user?.id === marketplace.sellerId;

  return (
    <FeedDestinationShell item={item} viewerId={user?.id}>
      {/* FeedDestinationShell already renders the cover, so the gallery only
          appears when it has extra photos to add — otherwise the same image
          rendered twice, stacked. */}
      {photos.length > 0 && <PhotoGallery photos={photos} fallbackUrl={null} />}
      <ProductDetails listing={marketplace} />
      {animalDetails && <PetDetailsPanel creature={animalDetails} />}
      {adoption && (
        <AdoptionHealthPanel
          listingId={adoption.id}
          isOwner={viewerIsSeller}
          details={adoption}
        />
      )}
      <VerificationPanel
        sellerVerified={sellerVerified}
        hasAnimal={Boolean(creatureId)}
        animalAttested={animalAttested}
      />
      <ListingInquiryPanel
        listingId={marketplace.id}
        sellerId={marketplace.sellerId}
        priceCents={marketplace.priceCents}
        viewerId={user?.id}
        viewerIsOperator={viewerIsOperator}
      />
      {adoption ? (
        // The screening form IS the adoption application — showing ApplyPanel
        // as well would give one listing two competing ways to apply.
        <AdoptionApplicationForm
          sellerId={marketplace.sellerId}
          listingId={marketplace.id}
          viewerId={user?.id}
          viewerIsSeller={viewerIsSeller}
          hasOpenApplication={Boolean(openApplication)}
        />
      ) : (
        <ApplyPanel
          sellerId={marketplace.sellerId}
          listingId={marketplace.id}
          viewerId={user?.id}
          viewerIsSeller={viewerIsSeller}
          hasOpenApplication={Boolean(openApplication)}
          paymentsEnabled={paymentsEnabled}
        />
      )}
    </FeedDestinationShell>
  );
}
