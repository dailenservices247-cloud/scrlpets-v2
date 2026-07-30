"use server";
import { revalidatePath } from "next/cache";
import { LITTER_SPECIES } from "@/lib/litters/constants";
import { createClient } from "@/lib/supabase/server";

/**
 * Save and skip are the SAME write: whatever survives the vocabulary filter
 * (nothing at all, if the person skipped) plus `onboarded_at`. Skipping is a
 * real answer, not an escape hatch that leaves the screen waiting to reappear.
 */
export async function completeOnboarding(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  // Only vocabulary values are stored, whatever the browser posts.
  const chosen = new Set(
    formData
      .getAll("species")
      .map(String)
      .filter((value) => (LITTER_SPECIES as readonly string[]).includes(value)),
  );

  const { error } = await supabase
    .from("profiles")
    .update({
      species_interests: [...chosen],
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
