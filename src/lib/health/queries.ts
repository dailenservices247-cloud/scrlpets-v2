import { createClient } from "@/lib/supabase/server";
import type { HealthReminderType, RepeatInterval } from "./constants";

export type CreatureOption = { id: string; name: string; species: string | null };

export type HealthReminder = {
  id: string;
  creatureId: string | null;
  reminderType: HealthReminderType;
  title: string;
  dueDate: string;
  repeatInterval: RepeatInterval;
  notes: string | null;
  completedAt: string | null;
};

type HealthReminderRow = {
  id: string;
  creature_id: string | null;
  reminder_type: HealthReminderType;
  title: string;
  due_date: string;
  repeat_interval: RepeatInterval;
  notes: string | null;
  completed_at: string | null;
};

export function mapReminderRow(row: HealthReminderRow): HealthReminder {
  return {
    id: row.id,
    creatureId: row.creature_id,
    reminderType: row.reminder_type,
    title: row.title,
    dueDate: row.due_date,
    repeatInterval: row.repeat_interval,
    notes: row.notes,
    completedAt: row.completed_at,
  };
}

/** Same "owner's own working list" query as lib/breeding/queries.ts — kept
 * duplicated rather than shared, since the two features aren't otherwise
 * coupled and this is 8 lines. */
export async function getMyCreatures(): Promise<CreatureOption[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("creatures")
    .select("id,name,species")
    .eq("owner_id", user.id)
    .is("archived_at", null)
    .order("name");
  return (data ?? []) as CreatureOption[];
}

/** Active (incomplete) reminders only — a completed reminder's job is done;
 * if it repeats, the DB trigger already inserted the next occurrence as a
 * fresh incomplete row, so it shows up here without any client bookkeeping. */
export async function getReminders(): Promise<HealthReminder[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("health_reminders")
    .select("id,creature_id,reminder_type,title,due_date,repeat_interval,notes,completed_at")
    .eq("profile_id", user.id)
    .is("completed_at", null)
    .order("due_date", { ascending: true });
  return ((data ?? []) as HealthReminderRow[]).map(mapReminderRow);
}
