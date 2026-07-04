"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isBrandRole, isBrandType } from "./types";

export type BrandActionResult = { ok: true } | { ok: false; error: string };
type CreateBrandResult = { ok: false; error: string };

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
export async function createBrand(formData: FormData): Promise<CreateBrandResult> {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const brandType = String(formData.get("brandType") ?? "");
  if (!name) return { ok: false, error: "required" };
  if (!isBrandType(brandType)) return { ok: false, error: "type" };

  // Immutable slug at create — same pattern as creatures (name-slugified + 4-char suffix).
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${crypto.randomUUID().slice(0, 4)}`;
  const { data: brand, error: brandErr } = await supabase
    .from("brands")
    .insert({ name, brand_type: brandType, owner_id: user.id, slug })
    .select("id")
    .single();
  if (brandErr) return { ok: false, error: brandErr.message };

  const { error: memErr } = await supabase
    .from("brand_memberships")
    .insert({ brand_id: brand.id, profile_id: user.id, role: "owner" });
  if (memErr) return { ok: false, error: memErr.message };

  // Land in the composer with the new brand preselected (?brand=) — without this,
  // multi-brand owners get their OLDEST brand auto-selected and misattribute the post.
  redirect(`/compose?brand=${brand.id}`);
}

export async function addBrandMember(formData: FormData): Promise<BrandActionResult> {
  const { supabase } = await requireUser();
  const brandId = String(formData.get("brandId") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (!brandId || !username) return { ok: false, error: "required" };
  if (!isBrandRole(role) || role === "owner") {
    return { ok: false, error: "invalid_role" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (profileError) return { ok: false, error: profileError.message };
  if (!profile) return { ok: false, error: "profile_not_found" };

  const { error } = await supabase.rpc("add_brand_member", {
    target_brand_id: brandId,
    target_profile_id: profile.id,
    target_role: role,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/brand-os");
  revalidatePath("/compose");
  return { ok: true };
}

export async function changeBrandMemberRole(
  formData: FormData,
): Promise<BrandActionResult> {
  const { supabase } = await requireUser();
  const membershipId = String(formData.get("membershipId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!membershipId) return { ok: false, error: "required" };
  if (!isBrandRole(role) || role === "owner") {
    return { ok: false, error: "invalid_role" };
  }

  const { error } = await supabase.rpc("change_brand_member_role", {
    target_membership_id: membershipId,
    target_role: role,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/brand-os");
  revalidatePath("/compose");
  return { ok: true };
}

export async function removeBrandMember(
  formData: FormData,
): Promise<BrandActionResult> {
  const { supabase } = await requireUser();
  const membershipId = String(formData.get("membershipId") ?? "");
  if (!membershipId) return { ok: false, error: "required" };

  const { error } = await supabase.rpc("remove_brand_member", {
    target_membership_id: membershipId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/brand-os");
  revalidatePath("/compose");
  return { ok: true };
}
