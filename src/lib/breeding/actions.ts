"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BreedingEventType } from "./constants";
import { mapBreedingEventRow, type BreedingEvent } from "./queries";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("auth_required");
  return { supabase, user };
}

const EVENT_COLUMNS =
  "id,creature_id,partner_creature_id,event_type,event_date,expected_due_date,notes";

export type BreedingEventInput = {
  creatureId: string;
  partnerCreatureId: string | null;
  eventType: BreedingEventType;
  eventDate: string;
  notes: string;
};

export type BreedingActionResult =
  | { ok: true; event: BreedingEvent }
  | { ok: false; error: string };

function friendlyError(message: string): string {
  if (message.includes("breeding_events_type_check")) return "invalid_type";
  if (message.includes("own insert breeding events") || message.includes("row-level security"))
    return "not_your_animal";
  return message;
}

/** Insert then read back the stored row — the DB trigger computes
 * expected_due_date BEFORE the row is written, so .select() after .insert()
 * already reflects it. No client-side gestation math anywhere in this file. */
export async function createBreedingEvent(
  input: BreedingEventInput,
): Promise<BreedingActionResult> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("breeding_events")
    .insert({
      breeder_id: user.id,
      creature_id: input.creatureId,
      partner_creature_id: input.partnerCreatureId,
      event_type: input.eventType,
      event_date: input.eventDate,
      notes: input.notes.trim() || null,
    })
    .select(EVENT_COLUMNS)
    .single();
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/calendar");
  return { ok: true, event: mapBreedingEventRow(data) };
}

export async function updateBreedingEvent(
  id: string,
  input: BreedingEventInput,
): Promise<BreedingActionResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("breeding_events")
    .update({
      creature_id: input.creatureId,
      partner_creature_id: input.partnerCreatureId,
      event_type: input.eventType,
      event_date: input.eventDate,
      notes: input.notes.trim() || null,
    })
    .eq("id", id)
    .select(EVENT_COLUMNS)
    .single();
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/calendar");
  return { ok: true, event: mapBreedingEventRow(data) };
}

export async function deleteBreedingEvent(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const { error, count } = await supabase
    .from("breeding_events")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "not_found" };
  revalidatePath("/calendar");
  return { ok: true };
}
