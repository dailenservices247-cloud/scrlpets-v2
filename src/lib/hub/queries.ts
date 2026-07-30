import { createClient } from "@/lib/supabase/server";
import { getOwnTree } from "@/lib/tree/queries";
import { listMyLitters } from "@/lib/litters/queries";
import { getBreedingEvents } from "@/lib/breeding/queries";
import { getMyBrands, type BrandAccess } from "@/lib/brands/queries";
import type { BrandCapability } from "./capabilities";

export type HubSummary = {
  animalCount: number;
  litterCount: number;
  upcomingEventCount: number;
  brands: BrandAccess[];
};

/**
 * Operator Hub (R2): person-scoped, cross-brand summary. Reuses the exact
 * queries /tree, /litters, and /calendar already call instead of standing up
 * parallel counting logic that could drift from those pages' own numbers.
 */
export async function getHubSummary(userId: string): Promise<HubSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const [tree, litters, events, brands] = await Promise.all([
    getOwnTree(userId),
    listMyLitters(userId),
    getBreedingEvents(),
    getMyBrands(userId),
  ]);
  return {
    animalCount: tree.creatures.length,
    litterCount: litters.length,
    upcomingEventCount: events.filter((e) => e.eventDate >= today).length,
    brands,
  };
}

/**
 * Brand OS's capability gate (R2). `brands.capabilities` isn't on MyBrand/
 * BrandAccess (src/lib/brands/queries.ts was out of this slice's edit scope),
 * so it's fetched here instead of extending that type.
 */
export async function getBrandCapabilities(brandId: string): Promise<BrandCapability[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("capabilities")
    .eq("id", brandId)
    .maybeSingle();
  return (data?.capabilities ?? []) as BrandCapability[];
}
