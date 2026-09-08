"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TreePrivacy } from "./queries";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("auth_required");
  return { supabase, user };
}

const GENDERS = new Set(["male", "female", "unknown"]);
const ROLES = new Set(["pet", "breeding"]);
const PRIVACY_VALUES = new Set<TreePrivacy>(["public", "buyers", "private"]);

export async function createTreeAnimal(formData: FormData): Promise<ActionResult & { id?: string }> {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "required" };
  const species = String(formData.get("species") ?? "").trim() || null;
  const breed = String(formData.get("breed") ?? "").trim() || null;
  const genderRaw = String(formData.get("gender") ?? "");
  const gender = GENDERS.has(genderRaw) ? genderRaw : null;
  const roleRaw = String(formData.get("creatureRole") ?? "pet");
  const creatureRole = ROLES.has(roleRaw) ? roleRaw : "pet";
  const birthDate = (formData.get("birthDate") as string) || null;
  // The same sheet adds an animal you own and an ancestor you are only
  // recording, and only the form knows which. Defaulting to the roster keeps
  // the honest reading of a missing field: a row nobody marked as somebody
  // else's animal is your own.
  const inRoster = formData.get("inRoster") !== "false";

  // Same immutable-slug convention as compose/actions.ts createCreature and brands/actions.ts createBrand.
  const slug = `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}-${crypto.randomUUID().slice(0, 4)}`;

  const { data, error } = await supabase
    .from("creatures")
    .insert({
      owner_id: user.id,
      name,
      species,
      breed,
      gender,
      creature_role: creatureRole,
      birth_date: birthDate,
      in_roster: inRoster,
      slug,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tree");
  return { ok: true, id: data.id };
}

export async function setTreePrivacy(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const value = String(formData.get("treePrivacy") ?? "");
  if (!PRIVACY_VALUES.has(value as TreePrivacy)) return { ok: false, error: "invalid_value" };

  const { error } = await supabase.from("profiles").update({ tree_privacy: value }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tree");
  return { ok: true };
}

/**
 * Correct a mis-set roster flag. Deliberately its own action rather than a
 * field on updateCreatureDetails: that one writes `creature_role: role || "pet"`
 * and eight other columns on every save, so folding in_roster into it would put
 * the roster in the blast radius of an unrelated edit — the exact reason this
 * is a separate column and not a third creature_role value.
 *
 * No default. createTreeAnimal reads a MISSING flag as "in the roster", which
 * is right at creation: an animal nobody marked as somebody else's is your own.
 * Here the same default would silently republish an ancestor onto the public
 * profile, so anything that is not exactly "true" or "false" writes nothing.
 *
 * Owner scoping is the "owner updates creatures" policy (20260729174753), which
 * is USING + WITH CHECK on owner_id — an id belonging to someone else matches
 * no row and updates nothing.
 */
export async function setInRoster(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const targetCreature = String(formData.get("targetCreature") ?? "");
  const value = String(formData.get("inRoster") ?? "");
  if (!targetCreature || (value !== "true" && value !== "false")) {
    return { ok: false, error: "required" };
  }

  const { error } = await supabase
    .from("creatures")
    .update({ in_roster: value === "true" })
    .eq("id", targetCreature);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tree");
  return { ok: true };
}

export async function linkParent(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const targetCreature = String(formData.get("targetCreature") ?? "");
  const targetParent = String(formData.get("targetParent") ?? "");
  const linkType = String(formData.get("linkType") ?? "");
  if (!targetCreature || !targetParent || (linkType !== "sire" && linkType !== "dam")) {
    return { ok: false, error: "required" };
  }

  const { error } = await supabase.rpc("link_creature_parent", {
    target_creature: targetCreature,
    target_parent: targetParent,
    link_type: linkType,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tree");
  return { ok: true };
}

export async function unlinkParent(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const targetCreature = String(formData.get("targetCreature") ?? "");
  const linkType = String(formData.get("linkType") ?? "");
  if (!targetCreature || (linkType !== "sire" && linkType !== "dam")) {
    return { ok: false, error: "required" };
  }

  const { error } = await supabase.rpc("unlink_creature_parent", {
    target_creature: targetCreature,
    link_type: linkType,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tree");
  return { ok: true };
}
