"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** R12: mark everything read (owner-only per RLS). */
export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) return { ok: false };
  revalidatePath("/notifications");
  return { ok: true };
}

/** Empty the notification centre. Owner-only DELETE policy already exists. */
export async function clearAllNotifications(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("recipient_id", user.id);
  if (error) return { ok: false };
  revalidatePath("/notifications");
  return { ok: true };
}

/**
 * Unread count for the live-region announcer.
 *
 * The announcer polls this instead of subscribing over Realtime because
 * `public.notifications` is not in the supabase_realtime publication (only
 * `public.messages` is) — a subscription would sit silent forever. Adding the
 * table to the publication needs a migration, which this lane cannot ship.
 */
export async function unreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}
