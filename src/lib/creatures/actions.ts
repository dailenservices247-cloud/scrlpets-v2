"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAnchorType, isCreatureRole, isGender, isGeneticTestType, isGeneticTestResult } from "./types";

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

/**
 * Register (or correct, or remove) the animal's identity anchor. Owner-only via
 * the same RLS policy the About sheet writes through.
 *
 * An empty value CLEARS the pair rather than erroring: the DB refuses a type
 * without a value, and clearing is the only way to release an anchor recorded
 * against the wrong animal — the value is globally unique, so until it's freed
 * the animal that really carries it can never register. Overwriting with a
 * placeholder would leave a fake anchor reading as "anchored".
 */
export async function setCreatureAnchor(
  creatureId: string,
  slug: string,
  formData: FormData,
): Promise<CreatureActionResult> {
  const { supabase } = await requireUser();
  const anchorType = String(formData.get("anchorType") ?? "");
  const anchorValue = str(formData, "anchorValue");
  if (anchorValue && !isAnchorType(anchorType)) return { ok: false, error: "invalid_type" };

  const { error } = await supabase
    .from("creatures")
    .update(
      anchorValue
        ? { anchor_type: anchorType, anchor_value: anchorValue }
        : { anchor_type: null, anchor_value: null },
    )
    .eq("id", creatureId);
  if (error) {
    // 23505: the partial unique index. Two animals sharing a number means the
    // anchor identifies neither, so this is a refusal, not a merge — and it is
    // an ordinary user event (a mistyped digit, or an animal already recorded).
    // The message never says WHICH animal holds it: that would turn a failed
    // write into a lookup of somebody else's private value.
    if (error.code === "23505") return { ok: false, error: "duplicate_anchor" };
    // 23514: a half-registered pair. The form cannot produce one, so this only
    // fires on a hand-rolled POST.
    if (error.code === "23514") return { ok: false, error: "invalid_anchor" };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}

/**
 * The handover check: yes/no on a scanned value, never the value itself. The
 * RPC answers false identically for a wrong value, an animal with no anchor,
 * and an unknown creature — so the UI must render ONE no-match state and never
 * explain which of the three it was.
 */
export async function verifyCreatureAnchor(
  creatureId: string,
  scannedValue: string,
): Promise<{ ok: true; match: boolean } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const value = scannedValue.trim();
  if (!value) return { ok: false, error: "required" };
  const { data, error } = await supabase.rpc("verify_creature_anchor", {
    target_creature: creatureId,
    scanned_value: value,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, match: data === true };
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

/** R8: archive/unarchive toggle. The RPC also sets page_visible=false when
 * archiving; unarchiving does NOT restore it — that stays the owner's
 * separate, deliberate choice via the About sheet's visibility checkbox. */
export async function setCreatureArchived(
  creatureId: string,
  slug: string,
  archived: boolean,
): Promise<CreatureActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("archive_creature", {
    target_creature: creatureId,
    archived,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}

/** The narrow "typed this into existence by mistake" escape hatch. Refuses
 * with `creature_referenced` the moment any lineage/litter/listing/alumni/
 * breeding/genetic-test/tagged-post row points at this creature — archiving
 * is the answer for anything with real history. */
export async function deleteCreaturePermanently(creatureId: string): Promise<CreatureActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_creature_if_unreferenced", {
    target_creature: creatureId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
