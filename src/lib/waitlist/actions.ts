"use server";
import { createClient } from "@/lib/supabase/server";
import { parseWaitlistInput } from "./parse";

export type WaitlistState = {
  ok: boolean;
  error?: "email" | "server";
} | null;

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const parsed = parseWaitlistInput(formData);
  if ("error" in parsed) {
    // A script gets a quiet yes; a person with a typo gets told.
    return parsed.error === "bot" ? { ok: true } : { ok: false, error: "email" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_signups").insert({
    email: parsed.email,
    species_interest: parsed.species,
    source: parsed.source,
  });

  // 23505 = the unique index: already on the list, which is a success — and
  // an indistinguishable one, so the form never confirms who is signed up.
  if (error && error.code !== "23505") return { ok: false, error: "server" };
  return { ok: true };
}
