import { createClient } from "@/lib/supabase/server";
import type { BreedingEventType } from "./constants";

export type CreatureOption = { id: string; name: string; species: string | null };

export type BreedingEvent = {
  id: string;
  creatureId: string;
  partnerCreatureId: string | null;
  eventType: BreedingEventType;
  eventDate: string;
  expectedDueDate: string | null;
  notes: string | null;
};

type BreedingEventRow = {
  id: string;
  creature_id: string;
  partner_creature_id: string | null;
  event_type: BreedingEventType;
  event_date: string;
  expected_due_date: string | null;
  notes: string | null;
};

export function mapBreedingEventRow(row: BreedingEventRow): BreedingEvent {
  return {
    id: row.id,
    creatureId: row.creature_id,
    partnerCreatureId: row.partner_creature_id,
    eventType: row.event_type,
    eventDate: row.event_date,
    expectedDueDate: row.expected_due_date,
    notes: row.notes,
  };
}

/** The signed-in breeder's own animals, for the event/partner pickers.
 * Not filtered by page_visible — hiding an animal from the public profile
 * doesn't mean its owner stops tracking it privately (matches breeder-os's
 * roster query, which is the same "owner's own working list" precedent). */
export async function getMyCreatures(): Promise<CreatureOption[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("creatures")
    .select("id,name,species")
    .eq("owner_id", user.id)
    .order("name");
  return (data ?? []) as CreatureOption[];
}

/** Every breeding event the signed-in breeder logged. RLS already scopes this
 * to their own rows; the explicit filter matches this codebase's convention
 * of filtering explicitly anyway (see getSellerListings, getRoster). */
export async function getBreedingEvents(): Promise<BreedingEvent[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("breeding_events")
    .select("id,creature_id,partner_creature_id,event_type,event_date,expected_due_date,notes")
    .eq("breeder_id", user.id)
    .order("event_date", { ascending: true });
  return ((data ?? []) as BreedingEventRow[]).map(mapBreedingEventRow);
}

/** species (lowercase) -> gestation_days. Public read table; used only for
 * an informational "≈N days" hint — the DB trigger computes the real due
 * date, this is never used to derive it client-side. */
export async function getGestationDays(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("species_gestation").select("species,gestation_days");
  return Object.fromEntries(
    ((data ?? []) as { species: string; gestation_days: number }[]).map((r) => [
      r.species,
      r.gestation_days,
    ]),
  );
}
