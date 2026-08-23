"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Enrolment, and the recovery path that keeps enrolment from being a trap.
 *
 * TOTP itself is Supabase's — `supabase.auth.mfa.*` runs in the browser because
 * the challenge/verify exchange belongs to the session that is being upgraded.
 * What lives here is the part Supabase does not provide: recovery.
 */
export type MfaResult = { ok: true } | { ok: false; error: string };

/**
 * Ten single-use codes, shown once.
 *
 * The plaintext is returned by the definer and never stored — a second call
 * replaces the set rather than re-showing it.
 */
export async function generateRecoveryCodes(): Promise<
  { ok: true; codes: string[] } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_mfa_recovery_codes");
  if (error) return { ok: false, error: error.message };
  const codes = ((data ?? []) as { code: string }[]).map((r) => r.code);
  revalidatePath("/settings/account");
  return { ok: true, codes };
}

/** How many codes are left, so the panel can nag before the last one is spent. */
export async function recoveryCodesRemaining(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("mfa_recovery_codes_remaining");
  return (data as number | null) ?? 0;
}

/**
 * Spend a recovery code and remove the second factor.
 *
 * ORDER OF OPERATIONS IS THE SECURITY PROPERTY. The code is spent FIRST, and
 * only a true result reaches the delete. The reverse — delete, then verify —
 * would let anyone holding a password session strip their own second factor by
 * submitting nonsense, which is not recovery but a way to switch MFA off from a
 * stolen session.
 *
 * The service role is required because a member locked out of their factor
 * holds only an AAL1 session, and Supabase will not let AAL1 unenrol a verified
 * factor. That is Supabase deciding what a session is worth, correctly; the
 * recovery code is what earns the app the right to overrule it.
 *
 * Refuses BEFORE spending a code when the service role is absent. Spending one
 * and then failing to delete would burn one of ten and leave MFA in place.
 */
export async function recoverWithCode(code: string): Promise<MfaResult> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { ok: false, error: "not_configured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  const { data: spent, error } = await supabase.rpc("consume_mfa_recovery_code", {
    candidate: code,
  });
  if (error) return { ok: false, error: error.message };
  if (spent !== true) return { ok: false, error: "invalid_code" };

  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
  const { data: listed, error: listError } = await service.auth.admin.mfa.listFactors({
    userId: user.id,
  });
  if (listError) return { ok: false, error: listError.message };

  // EVERY verified factor. Two authenticators with one left behind is still a
  // locked account, and the code has already been spent by this point.
  const verified = (listed?.factors ?? []).filter((f) => f.status === "verified");
  for (const factor of verified) {
    const { error: deleteError } = await service.auth.admin.mfa.deleteFactor({
      userId: user.id,
      id: factor.id,
    });
    if (deleteError) return { ok: false, error: deleteError.message };
  }

  revalidatePath("/settings/account");
  return { ok: true };
}
