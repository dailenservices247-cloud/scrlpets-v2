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

/** An animal listing carries its intent, because /market shows both at once. */
export type AnimalListing = AdoptionListing & { listingKind: "sale" | "adoption" };

export type AnimalFilters = {
  intent?: "sale" | "adoption";
  species?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
};

const ANIMAL_COLS =
  "id,title,description,price_cents,currency,availability,media_url,listing_kind," +
  "profiles!listings_seller_id_fkey(username)";

function toAnimal(r: Row & { listing_kind: "sale" | "adoption" }): AnimalListing {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    priceCents: r.price_cents,
    currency: r.currency,
    availability: r.availability,
    mediaUrl: r.media_url,
    listingKind: r.listing_kind,
    creature: r.creatures
      ? {
          name: r.creatures.name,
          species: r.creatures.species,
          slug: r.creatures.slug,
          avatarUrl: r.creatures.avatar_url,
        }
      : null,
    sellerUsername: r.profiles?.username ?? null,
  };
}

/**
 * The /market Animals tab: every listing with an animal attached, sale AND
 * adoption. R17 holds — rehoming is the same entity under the same gate, and a
 * weaker path for "free to a good home" would be a bypass, which is exactly
 * where animal scams operate. What changed is only that the two intents share
 * one browse surface: `/shop` filtered `sale AND creature_id IS NULL` and
 * `/adopt` filtered `adoption`, so a sale listing WITH an animal — the default
 * output of "list my animal" — matched neither and was browsable nowhere.
 */
export async function listAnimalListings(
  filters: AnimalFilters = {},
): Promise<AnimalListing[]> {
  const supabase = await createClient();
  // Same shape as the search filters: the species embed only becomes an INNER
  // join when species is actually being filtered on. A permanent inner join
  // would silently drop an animal listing whose creature row the viewer cannot
  // read, which is a visibility rule, not a browse rule.
  const creatureEmbed = filters.species
    ? "creatures!inner(name,species,slug,avatar_url)"
    : "creatures(name,species,slug,avatar_url)";
  let query = supabase
    .from("listings")
    .select(`${ANIMAL_COLS},${creatureEmbed}`)
    .not("creature_id", "is", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(60);
  if (filters.intent) query = query.eq("listing_kind", filters.intent);
  // Exact and case-insensitive, matching /search and the saved-search notify
  // trigger — a fuzzy filter here would preview results the alerts never send.
  if (filters.species) query = query.ilike("creatures.species", filters.species);
  if (filters.minPriceCents != null) query = query.gte("price_cents", filters.minPriceCents);
  if (filters.maxPriceCents != null) query = query.lte("price_cents", filters.maxPriceCents);

  const { data } = await query;
  return ((data ?? []) as unknown as (Row & { listing_kind: "sale" | "adoption" })[]).map(
    toAnimal,
  );
}

/** V2-03 structured fields. `null` is a real value here — unknown, never no. */
export type AdoptionDetail = AdoptionListing & {
  sellerId: string;
  spayedNeutered: boolean | null;
  vaccinated: boolean | null;
  microchipped: boolean | null;
  goodWithKids: boolean | null;
  goodWithDogs: boolean | null;
  goodWithCats: boolean | null;
  reason: string | null;
  specialNeeds: string | null;
};

type DetailRow = Row & {
  seller_id: string;
  adoption_spayed_neutered: boolean | null;
  adoption_vaccinated: boolean | null;
  adoption_microchipped: boolean | null;
  adoption_good_with_kids: boolean | null;
  adoption_good_with_dogs: boolean | null;
  adoption_good_with_cats: boolean | null;
  adoption_reason: string | null;
  adoption_special_needs: string | null;
};

const DETAIL_SELECT =
  "id,seller_id,title,description,price_cents,currency,availability,media_url," +
  "adoption_spayed_neutered,adoption_vaccinated,adoption_microchipped," +
  "adoption_good_with_kids,adoption_good_with_dogs,adoption_good_with_cats," +
  "adoption_reason,adoption_special_needs," +
  "creatures(name,species,slug,avatar_url)," +
  "profiles!listings_seller_id_fkey(username)";

/** Single adoption listing with the structured fields, for /listing/[id].
 * Scoped to listing_kind='adoption' so a sale id 404s here instead of
 * silently rendering — the two surfaces stay distinct on purpose. */
export async function getAdoptionDetail(id: string): Promise<AdoptionDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .eq("listing_kind", "adoption")
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;

  const r = data as unknown as DetailRow;
  return {
    id: r.id,
    sellerId: r.seller_id,
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
    spayedNeutered: r.adoption_spayed_neutered,
    vaccinated: r.adoption_vaccinated,
    microchipped: r.adoption_microchipped,
    goodWithKids: r.adoption_good_with_kids,
    goodWithDogs: r.adoption_good_with_dogs,
    goodWithCats: r.adoption_good_with_cats,
    reason: r.adoption_reason,
    specialNeeds: r.adoption_special_needs,
  };
}

/** The buyer's screening answers for a batch of application ids, keyed by
 * id. Deliberately separate from lib/applications/queries.ts (not this
 * lane's file to edit) — callers merge this with BuyerApplication rows they
 * already have (message, listingTitle, buyerUsername) rather than
 * re-selecting those joins here. */
export type AdoptionScreeningFields = {
  livingSituation: "house" | "apartment" | "condo" | "farm" | "other";
  hasYard: boolean;
  otherPets: string | null;
  experienceLevel: "first_time" | "some_experience" | "experienced";
};

type ScreeningRow = {
  id: string;
  living_situation: AdoptionScreeningFields["livingSituation"];
  has_yard: boolean;
  other_pets: string | null;
  experience_level: AdoptionScreeningFields["experienceLevel"];
};

export async function getAdoptionScreeningFields(
  applicationIds: string[],
): Promise<Record<string, AdoptionScreeningFields>> {
  if (applicationIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("buyer_applications")
    .select("id,living_situation,has_yard,other_pets,experience_level")
    .in("id", applicationIds)
    .not("living_situation", "is", null);

  const map: Record<string, AdoptionScreeningFields> = {};
  for (const row of (data ?? []) as unknown as ScreeningRow[]) {
    map[row.id] = {
      livingSituation: row.living_situation,
      hasYard: row.has_yard,
      otherPets: row.other_pets,
      experienceLevel: row.experience_level,
    };
  }
  return map;
}
