import { createClient } from "@/lib/supabase/server";

export type ServiceTierRate = {
  id: string;
  name: string;
  priceCents: number;
  description?: string;
};

export type ProviderService = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  priceCents: number | null;
  currency: string;
  area: string | null;
  contactNote: string | null;
  mediaUrl: string | null;
  ownerId: string;
  ownerUsername: string | null;
  brand: { name: string; slug: string } | null;
  ownerVerified: boolean;
  bookingEnabled: boolean;
  depositRequired: boolean;
  depositAmountCents: number | null;
  serviceTierRates: ServiceTierRate[];
  bookingNotice: string | null;
};

type Row = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price_cents: number | null;
  currency: string;
  area: string | null;
  contact_note: string | null;
  media_url: string | null;
  owner_id: string;
  booking_enabled?: boolean | null;
  deposit_required?: boolean | null;
  deposit_amount_cents?: number | null;
  service_tier_rates?: ServiceTierRate[] | null;
  booking_notice?: string | null;
  profiles: { username: string } | null;
  brands: { name: string; slug: string } | null;
};

const SELECT =
  "id,name,description,category,price_cents,currency,area,contact_note,media_url,owner_id," +
  "booking_enabled,deposit_required,deposit_amount_cents,service_tier_rates,booking_notice," +
  "profiles!services_owner_id_fkey(username),brands(name,slug)";

function toProviderService(r: Row, verifiedIds: Set<string>): ProviderService {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    priceCents: r.price_cents,
    currency: r.currency,
    area: r.area,
    contactNote: r.contact_note,
    mediaUrl: r.media_url,
    ownerId: r.owner_id,
    ownerUsername: r.profiles?.username ?? null,
    brand: r.brands ?? null,
    ownerVerified: verifiedIds.has(r.owner_id),
    bookingEnabled: r.booking_enabled ?? true,
    depositRequired: r.deposit_required ?? false,
    depositAmountCents: r.deposit_amount_cents ?? null,
    serviceTierRates: (r.service_tier_rates as ServiceTierRate[]) ?? [],
    bookingNotice: r.booking_notice ?? null,
  };
}

/**
 * R17: providers are listed while UNVERIFIED, and each card shows the
 * provider's real verification state. A service does not transfer an animal,
 * so the animal gate does not apply — but boarding and transport do take
 * custody, so a buyer deserves to see the truth rather than an implication
 * that Scrlpets vetted anybody.
 */
export async function listServices(category?: string): Promise<ProviderService[]> {
  const supabase = await createClient();
  let query = supabase
    .from("services")
    .select(SELECT)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(60);
  if (category) query = query.eq("category", category);
  const { data } = await query;

  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return [];

  // One round trip for the badges, and it returns only ids — no document data.
  const { data: verified } = await supabase.rpc("verified_profile_ids", {
    profile_ids: [...new Set(rows.map((r) => r.owner_id))],
  });
  const verifiedIds = new Set(
    ((verified ?? []) as { profile_id: string }[]).map((v) => v.profile_id),
  );

  return rows.map((r) => toProviderService(r, verifiedIds));
}

export type MyService = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  priceCents: number | null;
  area: string | null;
  contactNote: string | null;
  mediaUrl: string | null;
  active: boolean;
  brand: { id: string; name: string } | null;
  bookingEnabled: boolean;
  depositRequired: boolean;
  depositAmountCents: number | null;
  serviceTierRates: ServiceTierRate[];
  bookingNotice: string | null;
};

/**
 * Brand OS manager: every service the operator OWNS, active or retired.
 * Owner-scoped, not brand-scoped (R16) — edit rights follow ownership, and a
 * solo provider with no brand needs this list too.
 */
export async function listMyServices(userId: string): Promise<MyService[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select(
      "id,name,description,category,price_cents,area,contact_note,media_url,active,booking_enabled,deposit_required,deposit_amount_cents,service_tier_rates,booking_notice,brands(id,name)",
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  return (
    (data ?? []) as unknown as {
      id: string;
      name: string;
      description: string | null;
      category: string | null;
      price_cents: number | null;
      area: string | null;
      contact_note: string | null;
      media_url: string | null;
      active: boolean;
      booking_enabled?: boolean | null;
      deposit_required?: boolean | null;
      deposit_amount_cents?: number | null;
      service_tier_rates?: ServiceTierRate[] | null;
      booking_notice?: string | null;
      brands: { id: string; name: string } | null;
    }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    priceCents: r.price_cents,
    area: r.area,
    contactNote: r.contact_note,
    mediaUrl: r.media_url,
    active: r.active,
    brand: r.brands ?? null,
    bookingEnabled: r.booking_enabled ?? true,
    depositRequired: r.deposit_required ?? false,
    depositAmountCents: r.deposit_amount_cents ?? null,
    serviceTierRates: (r.service_tier_rates as ServiceTierRate[]) ?? [],
    bookingNotice: r.booking_notice ?? null,
  }));
}

export async function listServiceCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("category")
    .eq("active", true)
    .not("category", "is", null)
    .limit(200);
  return [...new Set(((data ?? []) as { category: string }[]).map((r) => r.category))].sort();
}

/** Active services offered by an establishment (`/b/[slug]`) or its operator. */
export async function listBrandServices(
  brandId: string,
  ownerId: string,
): Promise<ProviderService[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select(SELECT)
    .eq("active", true)
    .or(`brand_id.eq.${brandId},owner_id.eq.${ownerId}`)
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return [];
  const { data: verified } = await supabase.rpc("verified_profile_ids", {
    profile_ids: [...new Set(rows.map((r) => r.owner_id))],
  });
  const verifiedIds = new Set(
    ((verified ?? []) as { profile_id: string }[]).map((v) => v.profile_id),
  );
  return rows.map((r) => toProviderService(r, verifiedIds));
}

/** Active services offered by a specific profile (`/u/[username]`). */
export async function listProfileServices(profileId: string): Promise<ProviderService[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select(SELECT)
    .eq("active", true)
    .eq("owner_id", profileId)
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return [];
  const { data: verified } = await supabase.rpc("verified_profile_ids", {
    profile_ids: [profileId],
  });
  const verifiedIds = new Set(
    ((verified ?? []) as { profile_id: string }[]).map((v) => v.profile_id),
  );
  return rows.map((r) => toProviderService(r, verifiedIds));
}
