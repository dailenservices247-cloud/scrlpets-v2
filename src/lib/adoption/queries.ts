import { createClient } from "@/lib/supabase/server";

export type AdoptionListing = {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  currency: string;
  availability: string;
  mediaUrl: string | null;
  creature: { name: string; species: string | null; slug: string; avatarUrl: string | null } | null;
  sellerUsername: string | null;
};

type Row = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  currency: string;
  availability: string;
  media_url: string | null;
  creatures: { name: string; species: string | null; slug: string; avatar_url: string | null } | null;
  profiles: { username: string } | null;
};

/**
 * R17: rehoming is the same listing entity under the same verification gate.
 * A weaker gate for "free to a good home" would be a bypass, and that phrase
 * is exactly where animal scams operate.
 */
export async function listAdoptions(): Promise<AdoptionListing[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      "id,title,description,price_cents,currency,availability,media_url," +
        "creatures(name,species,slug,avatar_url)," +
        "profiles!listings_seller_id_fkey(username)",
    )
    .eq("listing_kind", "adoption")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(60);

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    priceCents: r.price_cents,
    currency: r.currency,
    availability: r.availability,
    mediaUrl: r.media_url,
    creature: r.creatures
      ? {
          name: r.creatures.name,
          species: r.creatures.species,
          slug: r.creatures.slug,
          avatarUrl: r.creatures.avatar_url,
        }
      : null,
    sellerUsername: r.profiles?.username ?? null,
  }));
}
