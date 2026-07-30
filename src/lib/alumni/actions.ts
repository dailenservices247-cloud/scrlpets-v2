"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPost } from "@/lib/compose/actions";

export type AlumniActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("auth_required");
  return { supabase, user };
}

/**
 * Post an update to an alumni timeline.
 *
 * The write itself is `createPost` — an update IS a post tagged to the animal,
 * so validation, suspension and attribution rules are the composer's, not a
 * second copy of them here. This only resolves which animal the alumni row
 * points at (RLS returns the row to the two parties and nobody else) and
 * revalidates the timeline the composer does not know about.
 */
export async function shareAlumniUpdate(
  alumniId: string,
  formData: FormData,
): Promise<AlumniActionResult> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("alumni")
    .select("creature_id")
    .eq("id", alumniId)
    .maybeSingle();
  if (!data) return { ok: false, error: "not_found" };
  const creatureId = (data as { creature_id: string | null }).creature_id;
  if (!creatureId) return { ok: false, error: "no_animal" };

  const post = new FormData();
  post.set("body", String(formData.get("body") ?? ""));
  post.set("mediaUrl", String(formData.get("mediaUrl") ?? ""));
  post.set("creatureId", creatureId);
  post.set("postingAsType", "person");
  const result = await createPost(post);
  if (!result.ok) return result;

  revalidatePath(`/pack/alumni/${alumniId}`);
  return { ok: true };
}

/**
 * Mute or unmute the viewer's own side of one alumni record.
 *
 * Which column to write is decided from the row, and the database's
 * `enforce_alumni_update` trigger refuses a write to the other party's flag —
 * so muting can never be done to someone.
 */
export async function setAlumniMute(
  alumniId: string,
  muted: boolean,
): Promise<AlumniActionResult> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("alumni")
    .select("breeder_id,owner_id")
    .eq("id", alumniId)
    .maybeSingle();
  if (!data) return { ok: false, error: "not_found" };
  const row = data as { breeder_id: string; owner_id: string };
  const column =
    row.breeder_id === user.id
      ? "muted_by_breeder"
      : row.owner_id === user.id
        ? "muted_by_owner"
        : null;
  if (!column) return { ok: false, error: "not_a_party" };

  const { error } = await supabase
    .from("alumni")
    .update({ [column]: muted })
    .eq("id", alumniId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pack/alumni");
  revalidatePath(`/pack/alumni/${alumniId}`);
  return { ok: true };
}

/** Plain-`<form action>` wrapper: the list re-renders from the database after. */
export async function setAlumniMuteForm(alumniId: string, muted: boolean): Promise<void> {
  await setAlumniMute(alumniId, muted);
}
