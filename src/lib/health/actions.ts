"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { HealthReminderType, RepeatInterval } from "./constants";
import { mapReminderRow, type HealthReminder } from "./queries";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("auth_required");
  return { supabase, user };
}

const REMINDER_COLUMNS =
  "id,creature_id,reminder_type,title,due_date,repeat_interval,notes,completed_at";

export type ReminderInput = {
  creatureId: string | null;
  reminderType: HealthReminderType;
  title: string;
  dueDate: string;
  repeatInterval: RepeatInterval;
  notes: string;
};

export type ReminderActionResult =
  | { ok: true; reminder: HealthReminder }
  | { ok: false; error: string };

function friendlyError(message: string): string {
  if (message.includes("health_reminders_title_check")) return "invalid_title";
  return message;
}

export async function createReminder(input: ReminderInput): Promise<ReminderActionResult> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("health_reminders")
    .insert({
      profile_id: user.id,
      creature_id: input.creatureId,
      reminder_type: input.reminderType,
      title: input.title.trim(),
      due_date: input.dueDate,
      repeat_interval: input.repeatInterval,
      notes: input.notes.trim() || null,
    })
    .select(REMINDER_COLUMNS)
    .single();
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/health");
  return { ok: true, reminder: mapReminderRow(data) };
}

export async function updateReminder(
  id: string,
  input: ReminderInput,
): Promise<ReminderActionResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("health_reminders")
    .update({
      creature_id: input.creatureId,
      reminder_type: input.reminderType,
      title: input.title.trim(),
      due_date: input.dueDate,
      repeat_interval: input.repeatInterval,
      notes: input.notes.trim() || null,
    })
    .eq("id", id)
    .select(REMINDER_COLUMNS)
    .single();
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/health");
  return { ok: true, reminder: mapReminderRow(data) };
}

export async function deleteReminder(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const { error, count } = await supabase
    .from("health_reminders")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "not_found" };
  revalidatePath("/health");
  return { ok: true };
}

/** Completing a repeat!=none reminder fires health_reminders_reschedule,
 * which inserts the next occurrence server-side — nothing to do here beyond
 * stamping completed_at and letting the caller refetch. */
export async function completeReminder(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const { error, count } = await supabase
    .from("health_reminders")
    .update({ completed_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "not_found" };
  revalidatePath("/health");
  return { ok: true };
}
