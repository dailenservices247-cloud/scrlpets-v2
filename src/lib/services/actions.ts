"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsePriceCents } from "@/lib/compose/validation";
import { SERVICE_CATEGORIES } from "./categories";

export type ServiceActionResult = { ok: true } | { ok: false; error: string };

type ServiceFields = {
  name: string;
  description: string | null;
  category: string | null;
  price_cents: number | null;
  area: string | null;
  contact_note: string | null;
};

/**
 * One shape check for create and edit. Price is optional because "contact for
 * a quote" is normal in this trade — empty means null, anything typed must be
 * a real positive amount (parsePriceCents refuses 0 and junk).
 */
function parseServiceFields(formData: FormData): ServiceFields | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 80) return { error: "name" };
  const rawCategory = String(formData.get("category") ?? "");
  const category = (SERVICE_CATEGORIES as readonly string[]).includes(rawCategory)
    ? rawCategory
    : null;
  const rawPrice = String(formData.get("price") ?? "").trim();
  let priceCents: number | null = null;
  if (rawPrice !== "") {
    priceCents = parsePriceCents(rawPrice);
    if (priceCents === null) return { error: "price" };
  }
  const bounded = (key: string, max: number) => {
    const value = String(formData.get(key) ?? "").trim();
    return value ? value.slice(0, max) : null;
  };
  return {
    name,
    description: bounded("description", 1000),
    category,
    price_cents: priceCents,
    area: bounded("area", 120),
    contact_note: bounded("contactNote", 300),
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

function revalidateServiceSurfaces() {
  revalidatePath("/brand-os");
  revalidatePath("/services");
}

/** Full marketplace record. RLS enforces owner + brand-manager on the insert. */
export async function createProviderService(
  formData: FormData,
): Promise<ServiceActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const fields = parseServiceFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };
  const brandId = (formData.get("brandId") as string) || null;

  const { error } = await ctx.supabase
    .from("services")
    .insert({ owner_id: ctx.user.id, brand_id: brandId, ...fields });
  if (error) return { ok: false, error: error.message };
  revalidateServiceSurfaces();
  return { ok: true };
}

/**
 * Owner-only by RLS ("owner updates services"); a non-owner update matches 0
 * rows and reports not_found rather than pretending it saved.
 */
export async function updateProviderService(
  serviceId: string,
  formData: FormData,
): Promise<ServiceActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const fields = parseServiceFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };

  const { count, error } = await ctx.supabase
    .from("services")
    .update({ ...fields, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", serviceId);
  if (error) return { ok: false, error: error.message };
  if (count !== 1) return { ok: false, error: "not_found" };
  revalidateServiceSurfaces();
  return { ok: true };
}

/** Retire/reactivate. Retiring keeps the row — history beats deletion. */
export async function setServiceActive(
  serviceId: string,
  active: boolean,
): Promise<ServiceActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const { count, error } = await ctx.supabase
    .from("services")
    .update({ active, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", serviceId);
  if (error) return { ok: false, error: error.message };
  if (count !== 1) return { ok: false, error: "not_found" };
  revalidateServiceSurfaces();
  return { ok: true };
}
