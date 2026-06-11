"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 80) || null;
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 500) || null;
  const avatarUrl = (formData.get("avatarUrl") as string) || undefined;
  const patch: Record<string, unknown> = { display_name: displayName, bio };
  if (avatarUrl) patch.avatar_url = avatarUrl;
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
