import { createClient } from "@/lib/supabase/server";

export type ProviderService = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  priceCents: number | null;
  currency: string;
  area: string | null;
  contactNote: string | null;
  ownerId: string;
  ownerUsername: string | null;
  brand: { name: string; slug: string } | null;
  ownerVerified: boolean;
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
  owner_id: string;
  profiles: { username: string } | null;
  brands: { name: string; slug: string } | null;
};

const SELECT =
  "id,name,description,category,price_cents,currency,area,contact_note,owner_id," +
  "profiles!services_owner_id_fkey(username),brands(name,slug)";

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

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    priceCents: r.price_cents,
    currency: r.currency,
    area: r.area,
    contactNote: r.contact_note,
    ownerId: r.owner_id,
    ownerUsername: r.profiles?.username ?? null,
    brand: r.brands ?? null,
    ownerVerified: verifiedIds.has(r.owner_id),
  }));
}

export type MyService = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  priceCents: number | null;
  area: string | null;
  contactNote: string | null;
  active: boolean;
  brand: { id: string; name: string } | null;
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
    .select("id,name,description,category,price_cents,area,contact_note,active,brands(id,name)")
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
      active: boolean;
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
    active: r.active,
    brand: r.brands ?? null,
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
