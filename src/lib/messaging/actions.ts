"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("auth_required");
  return { supabase, user };
}

/** Returns the conversation id for the pair, creating it if needed. */
export async function startConversation(
  otherUserId: string,
): Promise<{ id: string } | { error: string }> {
  const { supabase, user } = await requireUser();
  if (otherUserId === user.id) return { error: "self" };
  const [a, b] = [user.id, otherUserId].sort();
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (existing) return { id: existing.id };
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_a: a, user_b: b })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  if (trimmed.length > 2000) return { ok: false, error: "too_long" };
  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, body: trimmed });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/messages/${conversationId}`);
  return { ok: true };
}
