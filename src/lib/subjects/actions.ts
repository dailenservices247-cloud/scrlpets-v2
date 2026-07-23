"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SubjectResult = { ok: true } | { ok: false; error: string };

// Slice C scope A: name-only creation. RLS enforces owner + brand-manager.
async function createSubject(
  table: "litters" | "services",
  formData: FormData,
): Promise<SubjectResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };
  const name = String(formData.get("name") ?? "").trim();
  const brandId = (formData.get("brandId") as string) || null;
  if (!name || name.length > 80) return { ok: false, error: "name" };

  const { error } = await supabase
    .from(table)
    .insert({ owner_id: user.id, brand_id: brandId, name });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/brand-os");
  return { ok: true };
}

export async function createLitter(formData: FormData): Promise<SubjectResult> {
  return createSubject("litters", formData);
}

export async function createService(formData: FormData): Promise<SubjectResult> {
  return createSubject("services", formData);
}
