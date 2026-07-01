"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBrandType } from "./types";

type ActionResult = { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("auth_required");
  return { supabase, user };
}

/**
 * Create a brand and the owner's membership row (owner-only this slice), then redirect
 * to the composer. RLS also enforces owner_id = auth.uid() and self-membership; the
 * checks here are the app-layer guard. Returns ONLY on validation/DB failure; on success
 * it redirects (redirect throws NEXT_REDIRECT, so callers never receive an ok result).
 */
export async function createBrand(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const brandType = String(formData.get("brandType") ?? "");
  if (!name) return { ok: false, error: "required" };
  if (!isBrandType(brandType)) return { ok: false, error: "type" };

  const { data: brand, error: brandErr } = await supabase
    .from("brands")
    .insert({ name, brand_type: brandType, owner_id: user.id })
    .select("id")
    .single();
  if (brandErr) return { ok: false, error: brandErr.message };

  const { error: memErr } = await supabase
    .from("brand_memberships")
    .insert({ brand_id: brand.id, profile_id: user.id, role: "owner" });
  if (memErr) return { ok: false, error: memErr.message };

  redirect("/compose");
}
