"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateUsername } from "./username";

export async function updateProfile(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 80) || null;
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 500) || null;
  const avatarUrl = (formData.get("avatarUrl") as string) || undefined;
  const coverUrl = (formData.get("coverUrl") as string) || undefined;
  const patch: Record<string, unknown> = { display_name: displayName, bio };
  if (avatarUrl) patch.avatar_url = avatarUrl;
  if (coverUrl) patch.cover_url = coverUrl;
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Change your handle.
 *
 * The column is revoked from `authenticated` by design (20260801171418), so the
 * write goes through `set_username`, which enforces the same rules again in the
 * database. Validating here too is not duplication — it is what turns a raw
 * postgres error code into something a person can read.
 */
export async function changeUsername(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const parsed = validateUsername(String(formData.get("username") ?? ""));
  if (!parsed.ok) return { ok: false, error: parsed.reason };

  const { error } = await supabase.rpc("set_username", { new_username: parsed.value });
  if (error) {
    // The function raises bare codes (`username_taken`, `username_cooldown`).
    // Anything else is genuinely unexpected and says so rather than being
    // flattened into "taken".
    const known = [
      "username_taken",
      "username_cooldown",
      "username_reserved",
      "username_format",
      "username_length",
      "username_leading",
    ];
    const code = known.find((k) => error.message.includes(k));
    return { ok: false, error: code ?? error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
