import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getBrandsByOwner } from "@/lib/brands/queries";
import { listOwnBreedingCreatures } from "@/lib/litters/queries";

// ponytail: profiles.breeds_animals does not exist yet (requested from the
// main thread — see final report). Select it defensively: a missing column
// errors the query instead of throwing, and an error or unset value both
// read as "not opted in" rather than crashing the caller.
async function hasOptedIntoBreeding(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("breeds_animals")
    .eq("id", userId)
    .maybeSingle();
  return (data as { breeds_animals?: boolean } | null)?.breeds_animals === true;
}

/**
 * R1: surfaces derive from what a user HAS, plus one explicit opt-in — never
 * a signup lane pick. True when the user owns any brand, owns a creature with
 * creature_role='breeding', or opted in via profiles.breeds_animals.
 * Memoized per request (menu, bottom nav, and route guards all ask).
 */
export const isOperator = cache(async (userId: string): Promise<boolean> => {
  const [brands, breedingCreatures, optedIn] = await Promise.all([
    getBrandsByOwner(userId),
    listOwnBreedingCreatures(userId),
    hasOptedIntoBreeding(userId),
  ]);
  return brands.length > 0 || breedingCreatures.length > 0 || optedIn;
});
