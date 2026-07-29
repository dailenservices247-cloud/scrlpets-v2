"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { LITTER_SPECIES, LITTER_STATUSES, YOUNG_GENDERS } from "./constants";

export type LitterActionResult = { ok: true } | { ok: false; error: string };
export type LitterCreateResult = { ok: true; id: string } | { ok: false; error: string };

type LitterFields = {
  name: string;
  species: string | null;
  breed: string | null;
  description: string | null;
  expected_date: string | null;
  birth_date: string | null;
  status: string;
  sire_id: string | null;
  dam_id: string | null;
};

function bounded(formData: FormData, key: string, max: number): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value ? value.slice(0, max) : null;
}

function dateField(formData: FormData, key: string): string | null {
  // <input type="date"> already yields YYYY-MM-DD, which is exactly what a Postgres `date` column wants.
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

/** One shape check for create and edit, mirroring parseServiceFields in src/lib/services/actions.ts. */
function parseLitterFields(formData: FormData): LitterFields | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 80) return { error: "name" };
  const rawSpecies = String(formData.get("species") ?? "");
  const species = (LITTER_SPECIES as readonly string[]).includes(rawSpecies) ? rawSpecies : null;
  const rawStatus = String(formData.get("status") ?? "");
  const status = (LITTER_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : "expecting";
  return {
    name,
    species,
    breed: bounded(formData, "breed", 80),
    description: bounded(formData, "description", 1000),
    expected_date: dateField(formData, "expectedDate"),
    birth_date: dateField(formData, "birthDate"),
    status,
    sire_id: (formData.get("sireId") as string) || null,
    dam_id: (formData.get("damId") as string) || null,
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

function revalidateLitterSurfaces(litterId?: string) {
  revalidatePath("/litters");
  revalidatePath("/brand-os");
  // A litter's young ride /tree's genealogy view too (see syncLineage below).
  revalidatePath("/tree");
  if (litterId) revalidatePath(`/litters/${litterId}`);
}

/**
 * A litter's recorded dam/sire ARE the young's parents in the separate
 * creature_lineage graph that /tree renders (src/lib/tree/*, link_creature_parent
 * RPC) — a completely different mechanism from this table's own sire_id/dam_id.
 * Without this, a fully-recorded litter would still show its young as
 * disconnected founders on /tree despite the parents being known at record
 * time. Ownership of every id involved is already guaranteed by the callers
 * below (the litter, its dam/sire, and the young are all the same owner), so
 * the RPC's ownership/cycle guards should never realistically fire here — but
 * this is a best-effort enrichment, not the litter record itself, so any
 * rejection is swallowed rather than failing the caller's primary mutation.
 */
async function syncLineage(
  supabase: SupabaseClient,
  creatureIds: string[],
  sireId: string | null,
  damId: string | null,
) {
  if ((!sireId && !damId) || creatureIds.length === 0) return;
  await Promise.all(
    creatureIds.flatMap((id) => {
      const calls = [];
      if (sireId) {
        calls.push(
          supabase.rpc("link_creature_parent", {
            target_creature: id,
            target_parent: sireId,
            link_type: "sire",
          }),
        );
      }
      if (damId) {
        calls.push(
          supabase.rpc("link_creature_parent", {
            target_creature: id,
            target_parent: damId,
            link_type: "dam",
          }),
        );
      }
      return calls;
    }),
  );
}

/** RLS enforces owner_id = caller; the litters_parent_guard trigger enforces sire/dam ownership. */
export async function createLitter(formData: FormData): Promise<LitterCreateResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const fields = parseLitterFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };

  // Personal record by default — no brand picker in this wizard (product
  // lock: recording a litter implies no selling, and stays first-class alone).
  // A litter attached to a brand elsewhere (Brand OS's name-only creator)
  // still opens and edits here with its brand_id untouched, since these
  // fields never include it.
  const { data, error } = await ctx.supabase
    .from("litters")
    .insert({ owner_id: ctx.user.id, brand_id: null, ...fields })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateLitterSurfaces(data.id);
  return { ok: true, id: data.id };
}

/** Never touches brand_id — RLS (owner or brand manager) is the authority on who may call this. */
export async function updateLitter(litterId: string, formData: FormData): Promise<LitterActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const fields = parseLitterFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };

  const { count, error } = await ctx.supabase
    .from("litters")
    .update(fields, { count: "exact" })
    .eq("id", litterId);
  if (error) return { ok: false, error: error.message };
  if (count !== 1) return { ok: false, error: "not_found" };
  revalidateLitterSurfaces(litterId);
  return { ok: true };
}

/** Hard delete — litters has no deleted_at column. The young survive: creatures.litter_id is ON DELETE SET NULL. */
export async function deleteLitter(litterId: string): Promise<LitterActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const { count, error } = await ctx.supabase
    .from("litters")
    .delete({ count: "exact" })
    .eq("id", litterId);
  if (error) return { ok: false, error: error.message };
  if (count !== 1) return { ok: false, error: "not_found" };
  revalidateLitterSurfaces(litterId);
  return { ok: true };
}

/**
 * Links the caller's own creatures to the litter (creatures.litter_id). The
 * litter's ownership is checked explicitly here — RLS on `creatures` only
 * guarantees the CREATURE is the caller's own, nothing stops a crafted
 * litterId from pointing at someone else's litter otherwise (no trigger
 * cross-checks litter_id against its litter's owner).
 */
export async function linkYoung(litterId: string, creatureIds: string[]): Promise<LitterActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  if (creatureIds.length === 0) return { ok: true };

  const { data: litter } = await ctx.supabase
    .from("litters")
    .select("owner_id,sire_id,dam_id")
    .eq("id", litterId)
    .maybeSingle();
  if (!litter || litter.owner_id !== ctx.user.id) return { ok: false, error: "not_found" };

  const { error } = await ctx.supabase
    .from("creatures")
    .update({ litter_id: litterId })
    .in("id", creatureIds)
    .eq("owner_id", ctx.user.id);
  if (error) return { ok: false, error: error.message };

  await syncLineage(ctx.supabase, creatureIds, litter.sire_id, litter.dam_id);
  revalidateLitterSurfaces(litterId);
  return { ok: true };
}

/** Clears litter_id only for creatures currently in THIS litter — never touches creature_lineage (an established pedigree fact outlives the litter grouping). */
export async function unlinkYoung(litterId: string, creatureIds: string[]): Promise<LitterActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  if (creatureIds.length === 0) return { ok: true };

  const { error } = await ctx.supabase
    .from("creatures")
    .update({ litter_id: null })
    .in("id", creatureIds)
    .eq("owner_id", ctx.user.id)
    .eq("litter_id", litterId);
  if (error) return { ok: false, error: error.message };
  revalidateLitterSurfaces(litterId);
  return { ok: true };
}

/** Inline-add: a brand-new young creature, inheriting species/breed/birth date from the litter. */
export async function addYoung(litterId: string, formData: FormData): Promise<LitterCreateResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 80) return { ok: false, error: "name" };
  const rawGender = String(formData.get("gender") ?? "");
  const gender = (YOUNG_GENDERS as readonly string[]).includes(rawGender) ? rawGender : "unknown";

  // Re-fetched server-side rather than trusting client-submitted species/breed —
  // same "never trust a client-submitted X" discipline as resolveAttribution
  // in src/lib/compose/actions.ts. Also doubles as the litter-ownership check.
  const { data: litter, error: litterError } = await ctx.supabase
    .from("litters")
    .select("owner_id,species,breed,birth_date,sire_id,dam_id")
    .eq("id", litterId)
    .maybeSingle();
  if (litterError || !litter || litter.owner_id !== ctx.user.id) {
    return { ok: false, error: "not_found" };
  }

  // Same immutable-slug convention as createCreature in src/lib/compose/actions.ts.
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomUUID().slice(0, 4)}`;
  const { data, error } = await ctx.supabase
    .from("creatures")
    .insert({
      owner_id: ctx.user.id,
      name,
      slug,
      gender,
      species: litter.species,
      breed: litter.breed,
      birth_date: litter.birth_date,
      creature_role: "pet",
      litter_id: litterId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await syncLineage(ctx.supabase, [data.id], litter.sire_id, litter.dam_id);
  revalidateLitterSurfaces(litterId);
  return { ok: true, id: data.id };
}
