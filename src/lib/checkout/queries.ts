import { createClient } from "@/lib/supabase/server";

export type CheckoutTransporter = {
  serviceId: string;
  providerUsername: string | null;
  serviceName: string;
  priceCents: number | null;
  contactNote: string | null;
  recommended: boolean;
};

export type CheckoutListing = {
  id: string;
  title: string;
  priceCents: number;
  currency: string;
  sellerId: string;
  sellerUsername: string | null;
  hasAnimal: boolean;
  depositBps: number;
  inspectionHours: number;
  /** Null when the seller published none — the UI states that rather than hiding it. */
  guaranteeHeadline: string | null;
  recommendedTransportServiceId: string | null;
};

/**
 * Everything checkout needs about what is being bought, in one read.
 *
 * The FEE is deliberately not computed here. `create_order` derives it from the
 * seller's tier at the moment the order is struck and freezes it onto the order,
 * so a figure calculated for display would be a second source that could
 * disagree with the one actually charged.
 */
export async function getCheckoutListing(listingId: string): Promise<CheckoutListing | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      "id,title,price_cents,currency,seller_id,creature_id,deposit_bps,inspection_hours,recommended_transport_service_id,availability",
    )
    .eq("id", listingId)
    .is("deleted_at", null)
    .maybeSingle();
  const row = data as {
    id: string;
    title: string;
    price_cents: number;
    currency: string;
    seller_id: string;
    creature_id: string | null;
    deposit_bps: number;
    inspection_hours: number;
    recommended_transport_service_id: string | null;
    availability: string;
  } | null;
  if (!row || row.availability !== "available") return null;

  const [{ data: seller }, { data: guarantee }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", row.seller_id).maybeSingle(),
    supabase.rpc("listing_guarantee_text", { target_listing: listingId }),
  ]);

  const g = (guarantee as { kind: string; headline: string }[] | null)?.[0];

  return {
    id: row.id,
    title: row.title,
    priceCents: row.price_cents,
    currency: row.currency,
    sellerId: row.seller_id,
    sellerUsername: (seller as { username: string } | null)?.username ?? null,
    hasAnimal: Boolean(row.creature_id),
    depositBps: row.deposit_bps,
    inspectionHours: row.inspection_hours,
    guaranteeHeadline: g ? g.headline : null,
    recommendedTransportServiceId: row.recommended_transport_service_id,
  };
}

/**
 * Approved drivers covering BOTH ends of the route, seller's recommendation
 * first.
 *
 * The recommendation is a suggestion and is labelled as the seller's. It carries
 * no fee, no priority and no pre-selection — a seller may recommend, never
 * require, because the buyer is the one paying.
 */
export async function getRouteTransporters(
  fromRegion: string,
  toRegion: string,
  recommendedServiceId: string | null,
): Promise<CheckoutTransporter[]> {
  if (!fromRegion || !toRegion) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("transporters_for_route", {
    from_region: fromRegion,
    to_region: toRegion,
  });
  const rows = ((data ?? []) as {
    service_id: string;
    provider_username: string | null;
    service_name: string;
    price_cents: number | null;
    contact_note: string | null;
  }[]).map((r) => ({
    serviceId: r.service_id,
    providerUsername: r.provider_username,
    serviceName: r.service_name,
    priceCents: r.price_cents,
    contactNote: r.contact_note,
    recommended: r.service_id === recommendedServiceId,
  }));
  // Recommended first; the rest keep the RPC's cheapest-first ordering.
  return rows.sort((a, b) => Number(b.recommended) - Number(a.recommended));
}
