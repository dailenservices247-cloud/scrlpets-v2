"use server";

import { createClient } from "@/lib/supabase/server";
import { SUPPORT_CATEGORIES } from "./categories";
import { sendSupportConfirmation } from "./email";

export type SupportSubmitResult =
  | { ok: true; reference: string; emailSent: boolean; sentTo: string }
  | { ok: false; error: string };

/**
 * Bounds mirror the support_tickets_* check constraints. The DB is the
 * authority — this exists so a person gets a field name back instead of a
 * Postgres 23514, not as a second source of truth.
 */
const BOUNDS = {
  name: [2, 100],
  subject: [5, 200],
  message: [10, 10_000],
} as const;

function field(formData: FormData, key: keyof typeof BOUNDS): string | null {
  const value = String(formData.get(key) ?? "").trim();
  const [min, max] = BOUNDS[key];
  return value.length >= min && value.length <= max ? value : null;
}

// Same shape as support_tickets_email_check.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * File a support ticket. Works signed-out (the #1 support case is being locked
 * out of the account), and links to the profile when signed in.
 *
 * The row id is generated HERE rather than read back from the insert, because
 * `anon` has no SELECT policy on support_tickets and Postgres applies SELECT
 * policies to `INSERT ... RETURNING` — a guest insert with `.select()` fails
 * 42501. Supplying the id keeps one code path for guest and member and gives
 * the guest a reference the schema otherwise cannot hand them.
 */
export async function submitSupportTicket(
  formData: FormData,
): Promise<SupportSubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const name = field(formData, "name");
  if (!name) return { ok: false, error: "name" };
  const subject = field(formData, "subject");
  if (!subject) return { ok: false, error: "subject" };
  const message = field(formData, "message");
  if (!message) return { ok: false, error: "message" };

  const rawCategory = String(formData.get("category") ?? "");
  if (!(SUPPORT_CATEGORIES as readonly string[]).includes(rawCategory)) {
    return { ok: false, error: "category" };
  }

  // A signed-in person's ticket always carries their ACCOUNT address. Taking a
  // free-text address from an authenticated session would turn the
  // confirmation into an open relay aimed at anyone they care to name.
  const email = user?.email ?? String(formData.get("email") ?? "").trim();
  if (!EMAIL.test(email) || email.length > 320) return { ok: false, error: "email" };

  const id = crypto.randomUUID();
  const { error } = await supabase.from("support_tickets").insert({
    id,
    profile_id: user?.id ?? null,
    name,
    email,
    category: rawCategory,
    subject,
    message,
  });
  if (error) return { ok: false, error: "submit_failed" };

  // ponytail: no rate limit. Nothing stops a guest filing tickets in a loop —
  // the table has no per-email/IP throttle and adding one needs a migration
  // this lane does not own. Add a DB-side rate check if the queue gets flooded.
  const reference = id.slice(0, 8).toUpperCase();
  const { sent } = await sendSupportConfirmation({ reference, name, email, subject });
  return { ok: true, reference, emailSent: sent, sentTo: email };
}
