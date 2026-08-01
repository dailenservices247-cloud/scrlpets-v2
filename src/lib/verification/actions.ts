"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createIdentitySession } from "./stripe-identity";

export type VerificationResult =
  | { ok: true; redirectUrl?: string }
  | { ok: false; error: string };

/** D1/D5: begin identity verification. We store the session reference only. */
export async function startIdentityVerification(
  returnUrl: string,
): Promise<VerificationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  const session = await createIdentitySession(user.id, returnUrl);
  if (!session.ok) return { ok: false, error: session.reason };

  const { error } = await supabase.rpc("start_identity_verification", {
    session_ref: session.sessionId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, redirectUrl: session.url };
}

/**
 * D2: seller program credential — reference only (number + authority + public
 * URL). No document upload, so no sensitive-document storage returns.
 */
export async function submitSellerProgram(
  formData: FormData,
): Promise<VerificationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  const programType = String(formData.get("programType") ?? "");
  const credentialNumber = String(formData.get("credentialNumber") ?? "").trim();
  const issuingAuthority = String(formData.get("issuingAuthority") ?? "").trim();
  const publicUrl = (formData.get("publicUrl") as string)?.trim() || null;
  const brandId = (formData.get("brandId") as string) || null;
  if (!programType || !credentialNumber || !issuingAuthority) {
    return { ok: false, error: "required" };
  }

  const { error } = await supabase.from("seller_programs").insert({
    profile_id: user.id,
    brand_id: brandId,
    program_type: programType,
    credential_number: credentialNumber,
    issuing_authority: issuingAuthority,
    public_url: publicUrl,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/verification");
  return { ok: true };
}

/** Buyer readiness (D2): attestation only in v1; phone verification is banked. */
export async function attestBuyerReadiness(): Promise<VerificationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };
  const { error } = await supabase
    .from("buyer_readiness")
    .insert({ profile_id: user.id });
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/settings/verification");
  return { ok: true };
}

/**
 * Per-animal eligibility. A verified seller does NOT automatically make every
 * animal listable — the owner attests each one (ledger requirement).
 */
export async function attestAnimalEligibility(
  creatureId: string,
): Promise<VerificationResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attest_animal_eligibility", {
    target_creature: creatureId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/verification");
  // The animal route keys on slug, not id, so `/c/<uuid>` matched no cache
  // entry at all. ponytail: invalidate the whole pattern rather than adding a
  // slug lookup to an action that attests one animal at a time.
  revalidatePath("/c/[slug]", "page");
  return { ok: true };
}

/**
 * Admin decision on a program submission (D4 role; enforced in the DB).
 *
 * Two separate fields on purpose. `notes` is the internal record and the
 * applicant can never read it; `reasonCode` is the one thing they are told, and
 * it is a code rather than free text so the reviewer's note stays a note. The
 * definer refuses a rejection without a code, so this cannot silently go back
 * to "rejected, no reason".
 */
export async function reviewSellerProgram(
  programId: string,
  decision: "approved" | "rejected",
  notes?: string,
  reasonCode?: string,
): Promise<VerificationResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_seller_program", {
    target_program: programId,
    decision,
    notes: notes ?? null,
    reason_code: reasonCode ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
