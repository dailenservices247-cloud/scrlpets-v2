"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AdoptionActionResult = { ok: true } | { ok: false; error: string };

function triFromForm(formData: FormData, name: string): boolean | null {
  const raw = formData.get(name);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

/**
 * Owner-only edit of the structured adoption fields. ListingForm (compose)
 * and the /listing/[id]/edit page are outside this lane's granted paths, so
 * this is the one place a seller can set health/good-with/reason/special-
 * needs after the listing exists — see AdoptionHealthPanel's inline editor.
 */
export async function updateAdoptionDetails(
  listingId: string,
  formData: FormData,
): Promise<AdoptionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  const { count, error } = await supabase
    .from("listings")
    .update(
      {
        adoption_spayed_neutered: triFromForm(formData, "spayedNeutered"),
        adoption_vaccinated: triFromForm(formData, "vaccinated"),
        adoption_microchipped: triFromForm(formData, "microchipped"),
        adoption_good_with_kids: triFromForm(formData, "goodWithKids"),
        adoption_good_with_dogs: triFromForm(formData, "goodWithDogs"),
        adoption_good_with_cats: triFromForm(formData, "goodWithCats"),
        adoption_reason: String(formData.get("reason") ?? "").trim() || null,
        adoption_special_needs: String(formData.get("specialNeeds") ?? "").trim() || null,
      },
      { count: "exact" },
    )
    .eq("id", listingId)
    .eq("listing_kind", "adoption")
    .is("deleted_at", null);
  if (error) return { ok: false, error: error.message };
  if (count !== 1) return { ok: false, error: "not_found" };

  revalidatePath(`/listing/${listingId}`);
  return { ok: true };
}

export type AdoptionApplicationInput = {
  sellerId: string;
  listingId: string;
  message: string;
  livingSituation: "house" | "apartment" | "condo" | "farm" | "other";
  hasYard: boolean;
  otherPets: string;
  experienceLevel: "first_time" | "some_experience" | "experienced";
};

/**
 * The V2-03 screening application — a fixed set of adoption questions
 * written straight to buyer_applications alongside the free-text message.
 * Kept separate from submitApplication (lib/applications/actions.ts, not a
 * file this lane owns): that path only ever collects a message, and this
 * one is adoption-only with a required "why" and a full screening set.
 */
export async function submitAdoptionApplication(
  input: AdoptionApplicationInput,
): Promise<AdoptionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };
  const message = input.message.trim();
  if (!message) return { ok: false, error: "message_required" };

  const { error } = await supabase.from("buyer_applications").insert({
    buyer_id: user.id,
    seller_id: input.sellerId,
    listing_id: input.listingId,
    message,
    living_situation: input.livingSituation,
    has_yard: input.hasYard,
    other_pets: input.otherPets.trim() || null,
    experience_level: input.experienceLevel,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.toLowerCase().includes("duplicate") ? "already_applied" : error.message,
    };
  }
  revalidatePath("/applications");
  revalidatePath(`/listing/${input.listingId}`);
  return { ok: true };
}
