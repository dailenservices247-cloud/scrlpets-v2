import { createClient } from "@/lib/supabase/server";

export type RosterAnimal = {
  id: string;
  name: string;
  species: string | null;
  slug: string;
  avatarUrl: string | null;
  attested: boolean;
  hasRecords: boolean;
  listingId: string | null;
  listingAvailability: string | null;
};

export type SellerListing = {
  id: string;
  title: string;
  priceCents: number;
  currency: string;
  availability: string;
  creatureId: string | null;
  brandId: string | null;
  createdAt: string;
};

export type ReadinessStep = {
  key: "identity" | "program" | "animals" | "records" | "listing";
  done: boolean;
  href: string;
};

export type BreederStats = {
  animals: number;
  animalsAttested: number;
  animalsWithRecords: number;
  listings: number;
  listingsSold: number;
  openApplications: number;
};

/**
 * R16: the operator's animal roster. Scoped to the signed-in person, not the
 * brand — animals are owned by a profile (creatures.owner_id), and pretending
 * otherwise would show an operator someone else's animals.
 */
export async function getRoster(ownerId: string): Promise<RosterAnimal[]> {
  const supabase = await createClient();
  const { data: creatures } = await supabase
    .from("creatures")
    .select("id,name,species,slug,avatar_url")
    .eq("owner_id", ownerId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (creatures ?? []) as {
    id: string;
    name: string;
    species: string | null;
    slug: string;
    avatar_url: string | null;
  }[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [eligibility, records, listings] = await Promise.all([
    supabase.from("animal_eligibility").select("creature_id,status").in("creature_id", ids),
    supabase.from("animal_records").select("creature_id").in("creature_id", ids),
    supabase
      .from("listings")
      .select("id,creature_id,availability")
      .in("creature_id", ids)
      .is("deleted_at", null),
  ]);

  const attested = new Set(
    ((eligibility.data ?? []) as { creature_id: string; status: string }[])
      .filter((e) => e.status === "attested")
      .map((e) => e.creature_id),
  );
  const withRecords = new Set(
    ((records.data ?? []) as { creature_id: string }[]).map((r) => r.creature_id),
  );
  const listingByCreature = new Map(
    ((listings.data ?? []) as { id: string; creature_id: string; availability: string }[]).map(
      (l) => [l.creature_id, l],
    ),
  );

  return rows.map((r) => {
    const listing = listingByCreature.get(r.id);
    return {
      id: r.id,
      name: r.name,
      species: r.species,
      slug: r.slug,
      avatarUrl: r.avatar_url,
      attested: attested.has(r.id),
      hasRecords: withRecords.has(r.id),
      listingId: listing?.id ?? null,
      listingAvailability: listing?.availability ?? null,
    };
  });
}

/** The operator's own listings, newest first. */
export async function getSellerListings(sellerId: string): Promise<SellerListing[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("id,title,price_cents,currency,availability,creature_id,brand_id,created_at")
    .eq("seller_id", sellerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as {
    id: string;
    title: string;
    price_cents: number;
    currency: string;
    availability: string;
    creature_id: string | null;
    brand_id: string | null;
    created_at: string;
  }[]).map((l) => ({
    id: l.id,
    title: l.title,
    priceCents: l.price_cents,
    currency: l.currency,
    availability: l.availability,
    creatureId: l.creature_id,
    brandId: l.brand_id,
    createdAt: l.created_at,
  }));
}

/**
 * Replaces the legacy "trust score". That score awarded points for uploading
 * an avatar and 20 of 100 for PAYING for premium, which made a paid decoration
 * indistinguishable from a real check. This is a checklist of things that are
 * actually true, with no number and nothing purchasable.
 */
export async function getReadiness(
  ownerId: string,
  roster: RosterAnimal[],
  listings: SellerListing[],
): Promise<ReadinessStep[]> {
  const supabase = await createClient();
  const [identity, programs] = await Promise.all([
    supabase.from("identity_verifications").select("status").maybeSingle(),
    supabase.from("seller_programs").select("status").eq("profile_id", ownerId),
  ]);
  const identityVerified =
    (identity.data as { status: string } | null)?.status === "verified";
  const programApproved = ((programs.data ?? []) as { status: string }[]).some(
    (p) => p.status === "approved",
  );

  return [
    { key: "identity", done: identityVerified, href: "/settings/verification" },
    { key: "program", done: programApproved, href: "/settings/verification" },
    { key: "animals", done: roster.length > 0, href: "/compose" },
    { key: "records", done: roster.some((a) => a.hasRecords), href: roster[0] ? `/c/${roster[0].slug}` : "/compose" },
    { key: "listing", done: listings.length > 0, href: "/compose?kind=listing" },
  ];
}

/** Honest counts of the operator's OWN records. Nothing modelled or projected. */
export async function getBreederStats(
  ownerId: string,
  roster: RosterAnimal[],
  listings: SellerListing[],
): Promise<BreederStats> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("buyer_applications")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", ownerId)
    .eq("status", "submitted");
  return {
    animals: roster.length,
    animalsAttested: roster.filter((a) => a.attested).length,
    animalsWithRecords: roster.filter((a) => a.hasRecords).length,
    listings: listings.length,
    listingsSold: listings.filter((l) => l.availability === "sold").length,
    openApplications: count ?? 0,
  };
}
