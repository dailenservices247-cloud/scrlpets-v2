"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReviewResult = { ok: true } | { ok: false; error: string };

/**
 * Each party confirms their own side of the handover. Both confirmations are
 * what unlocks a review — the definer refuses to let either side confirm for
 * the other.
 */
export async function confirmHandover(applicationId: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_handover", {
    target_application: applicationId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  return { ok: true };
}

export async function submitReview(
  applicationId: string,
  subjectId: string,
  input: {
    rating: number;
    accuracy?: number | null;
    communication?: number | null;
    health?: number | null;
    title?: string;
    body?: string;
  },
): Promise<ReviewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  const { error } = await supabase.from("reviews").insert({
    application_id: applicationId,
    reviewer_id: user.id,
    subject_id: subjectId,
    rating: input.rating,
    accuracy_rating: input.accuracy ?? null,
    communication_rating: input.communication ?? null,
    health_rating: input.health ?? null,
    title: input.title?.trim() || null,
    body: input.body?.trim() || null,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.toLowerCase().includes("duplicate")
        ? "already_reviewed"
        : error.message,
    };
  }
  revalidatePath("/applications");
  revalidatePath(`/u/${subjectId}`);
  return { ok: true };
}
