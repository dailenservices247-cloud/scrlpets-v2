"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isCreatureRole, isGender, isGeneticTestType, isGeneticTestResult } from "./types";

export type CreatureActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("auth_required");
  return { supabase, user };
}

function str(fd: FormData, key: string): string | null {
  return String(fd.get(key) ?? "").trim() || null;
}

/** Owner edit sheet: the About card's fields + role + page visibility.
 * owner_id/slug stay frozen by the DB trigger regardless of payload. */
export async function updateCreatureDetails(
  creatureId: string,
  slug: string,
  formData: FormData,
): Promise<CreatureActionResult> {
  const { supabase } = await requireUser();
  const role = String(formData.get("creatureRole") ?? "");
  const gender = String(formData.get("gender") ?? "");
  if (role && !isCreatureRole(role)) return { ok: false, error: "invalid_role" };
  if (gender && !isGender(gender)) return { ok: false, error: "invalid_gender" };

  const { error } = await supabase
    .from("creatures")
    .update({
      species: str(formData, "species"),
      breed: str(formData, "breed"),
      gender: gender || null,
      color: str(formData, "color"),
      markings: str(formData, "markings"),
      birth_date: str(formData, "birthDate"),
      registration_number: str(formData, "registrationNumber"),
      creature_role: role || "pet",
      page_visible: formData.get("pageVisible") === "true",
    })
    .eq("id", creatureId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}

/** Genetic tests are self-reported by the CREATURE'S OWNER (recorded_by is
 * whoever wrote it, but RLS gates writes on creature ownership — see
 * 20260729174903_breeder_records.sql). */
export async function addGeneticTest(
  creatureId: string,
  slug: string,
  formData: FormData,
): Promise<CreatureActionResult> {
  const { supabase, user } = await requireUser();
  const testType = String(formData.get("testType") ?? "");
  const result = String(formData.get("result") ?? "");
  const conditionName = str(formData, "conditionName");
  if (!isGeneticTestType(testType)) return { ok: false, error: "invalid_type" };
  if (!isGeneticTestResult(result)) return { ok: false, error: "invalid_result" };
  if (!conditionName) return { ok: false, error: "required" };

  const { error } = await supabase.from("genetic_tests").insert({
    creature_id: creatureId,
    recorded_by: user.id,
    test_type: testType,
    condition_name: conditionName,
    result,
    grade: str(formData, "grade"),
    gene_name: str(formData, "geneName"),
    genotype: str(formData, "genotype"),
    provider: str(formData, "provider"),
    test_date: str(formData, "testDate"),
    certificate_number: str(formData, "certificateNumber"),
    notes: str(formData, "notes"),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}

export async function updateGeneticTest(
  testId: string,
  slug: string,
  formData: FormData,
): Promise<CreatureActionResult> {
  const { supabase } = await requireUser();
  const testType = String(formData.get("testType") ?? "");
  const result = String(formData.get("result") ?? "");
  const conditionName = str(formData, "conditionName");
  if (!isGeneticTestType(testType)) return { ok: false, error: "invalid_type" };
  if (!isGeneticTestResult(result)) return { ok: false, error: "invalid_result" };
  if (!conditionName) return { ok: false, error: "required" };

  const { error } = await supabase
    .from("genetic_tests")
    .update({
      test_type: testType,
      condition_name: conditionName,
      result,
      grade: str(formData, "grade"),
      gene_name: str(formData, "geneName"),
      genotype: str(formData, "genotype"),
      provider: str(formData, "provider"),
      test_date: str(formData, "testDate"),
      certificate_number: str(formData, "certificateNumber"),
      notes: str(formData, "notes"),
    })
    .eq("id", testId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}

export async function deleteGeneticTest(testId: string, slug: string): Promise<CreatureActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("genetic_tests").delete().eq("id", testId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}

/** Mark: reversible by design (unlike legacy — see
 * 20260729174753_creature_model_expansion.sql). The DB constraint requires a
 * date whenever a message is set; a bare date with no message is fine. */
export async function setMemorial(
  creatureId: string,
  slug: string,
  formData: FormData,
): Promise<CreatureActionResult> {
  const { supabase } = await requireUser();
  const deceasedAt = str(formData, "deceasedAt");
  if (!deceasedAt) return { ok: false, error: "required" };
  const { error } = await supabase
    .from("creatures")
    .update({ deceased_at: deceasedAt, memorial_message: str(formData, "memorialMessage") })
    .eq("id", creatureId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}

export async function clearMemorial(creatureId: string, slug: string): Promise<CreatureActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("creatures")
    .update({ deceased_at: null, memorial_message: null })
    .eq("id", creatureId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}
