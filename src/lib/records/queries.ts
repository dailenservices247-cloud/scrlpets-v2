import { createClient } from "@/lib/supabase/server";

export type AnimalRecord = {
  vaccinationsDeclared: string | null;
  healthNotesDeclared: string | null;
  pedigreeNotesDeclared: string | null;
  birthDateDeclared: string | null;
  vetAttestedAt: string | null;
};

/**
 * D6: owner-declared animal records. Every field is labelled as the owner's own
 * claim in the UI — the vet-attested slot stays empty until the vet pilot, and
 * the DB refuses to let an owner write it.
 */
export async function getAnimalRecord(creatureId: string): Promise<AnimalRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("animal_records")
    .select(
      "vaccinations_declared,health_notes_declared,pedigree_notes_declared,birth_date_declared,vet_attested_at",
    )
    .eq("creature_id", creatureId)
    .maybeSingle();
  if (!data) return null;
  const r = data as {
    vaccinations_declared: string | null;
    health_notes_declared: string | null;
    pedigree_notes_declared: string | null;
    birth_date_declared: string | null;
    vet_attested_at: string | null;
  };
  return {
    vaccinationsDeclared: r.vaccinations_declared,
    healthNotesDeclared: r.health_notes_declared,
    pedigreeNotesDeclared: r.pedigree_notes_declared,
    birthDateDeclared: r.birth_date_declared,
    vetAttestedAt: r.vet_attested_at,
  };
}
