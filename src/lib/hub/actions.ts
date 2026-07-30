"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isBrandCapability, type BrandCapability } from "./capabilities";

type CapabilityResult = { ok: true } | { ok: false; error: string };

/**
 * R2 capability editor. Authorization is column-level at the DB (RLS +
 * `grant update (capabilities) on table public.brands to authenticated` in
 * supabase/migrations/20260730073541_capabilities_archive_withdraw.sql); the
 * UI additionally only renders this for brand managers (canManageBrandContent).
 */
export async function updateBrandCapabilities(
  brandId: string,
  capabilities: string[],
): Promise<CapabilityResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  const clean = capabilities.filter(isBrandCapability) as BrandCapability[];
  const { error } = await supabase
    .from("brands")
    .update({ capabilities: clean })
    .eq("id", brandId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/brand-os");
  return { ok: true };
}
