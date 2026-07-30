"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Mirrors the DB cap (saved_searches insert policy) so the UI can give an
// honest "you're full" message instead of waiting on a raw Postgres error.
const SAVED_SEARCH_CAP = 20;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

export type SavedSearchActionResult = { ok: true } | { ok: false; error: string };

export type SavedSearchInput = {
  name: string;
  query: string;
  species: string | null;
  listingKind: "sale" | "adoption" | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  notifyEnabled: boolean;
};

/** Captures the current search + filters as a named, optionally-alerting saved search. */
export async function saveSearch(input: SavedSearchInput): Promise<SavedSearchActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "name" };

  const { count } = await ctx.supabase
    .from("saved_searches")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", ctx.user.id);
  if ((count ?? 0) >= SAVED_SEARCH_CAP) return { ok: false, error: "cap_reached" };

  const { error } = await ctx.supabase.from("saved_searches").insert({
    profile_id: ctx.user.id,
    name,
    query: input.query.trim().slice(0, 200),
    species: input.species,
    listing_kind: input.listingKind,
    min_price_cents: input.minPriceCents,
    max_price_cents: input.maxPriceCents,
    notify_enabled: input.notifyEnabled,
  });
  if (error) return { ok: false, error: "failed" };
  revalidatePath("/search");
  return { ok: true };
}

/** Owner-only by RLS; a non-owner delete matches 0 rows and reports not_found. */
export async function deleteSavedSearch(id: string): Promise<SavedSearchActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const { count, error } = await ctx.supabase
    .from("saved_searches")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { ok: false, error: "failed" };
  if (count !== 1) return { ok: false, error: "not_found" };
  revalidatePath("/search");
  return { ok: true };
}

export async function setSavedSearchAlerts(
  id: string,
  enabled: boolean,
): Promise<SavedSearchActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "auth_required" };
  const { count, error } = await ctx.supabase
    .from("saved_searches")
    .update({ notify_enabled: enabled }, { count: "exact" })
    .eq("id", id);
  if (error) return { ok: false, error: "failed" };
  if (count !== 1) return { ok: false, error: "not_found" };
  revalidatePath("/search");
  return { ok: true };
}
