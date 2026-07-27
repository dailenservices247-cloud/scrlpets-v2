"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * D6: the owner edits their own declared fields. vet_attested_* is deliberately
 * absent from this payload AND blocked by a DB trigger, so a forged attestation
 * is impossible from any client path.
 */
export async function saveAnimalRecord(
  creatureId: string,
  slug: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const value = (key: string) => (String(formData.get(key) ?? "").trim() || null);

  const { error } = await supabase.from("animal_records").upsert(
    {
      creature_id: creatureId,
      vaccinations_declared: value("vaccinations"),
      health_notes_declared: value("healthNotes"),
      pedigree_notes_declared: value("pedigreeNotes"),
      birth_date_declared: value("birthDate"),
    },
    { onConflict: "creature_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}
