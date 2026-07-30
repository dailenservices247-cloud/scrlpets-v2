"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isMessageReactionEmoji } from "./reaction-emoji";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("auth_required");
  return { supabase, user };
}

/**
 * Where the conversation came from — this is what decides the request gate.
 *
 * "inquiry" is the default because every server-side caller today is an
 * inquiry flow (a listing or service inquiry IS a legitimate knock, per the
 * A.6 migration), and those must stay ungated. The profile Message button
 * passes "direct" to arm the gate on a genuinely cold DM.
 */
// No `origin` parameter on purpose. It used to let the caller declare a
// conversation "inquiry" and be born `active`, skipping the request gate — but
// the caller is the client, so that was a claim the DB had no way to check. An
// active conversation is now either earned (an accepted pack link) or minted by
// a SECURITY DEFINER RPC that verified real evidence, e.g. start_listing_inquiry.
// A restrictive INSERT policy enforces the same rule underneath this code.

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
  // ponytail: an existing `declined` conversation stays declined even when the
  // second approach is an inquiry. Re-opening on inquiry would hand anyone a
  // one-click way back into a thread they were shown the door on; the RLS
  // request gate then refuses the send and the UI says so.
  if (existing) return { id: existing.id };

  // Packmates knock freely — an accepted pack link is consent already given.
  let gated = true;
  {
    const { data: pack } = await supabase
      .from("pack_links")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`,
      )
      .maybeSingle();
    if (pack) gated = false;
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_a: a,
      user_b: b,
      status: gated ? "request" : "active",
      // Always recorded: resolve_message_request refuses the initiator, and a
      // null initiated_by would let either party resolve their own knock.
      initiated_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export type SentMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  mediaUrl: string | null;
};

export async function sendMessage(
  conversationId: string,
  body: string,
  mediaUrl?: string | null,
): Promise<{ ok: true; message: SentMessage } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  const trimmed = body.trim();
  if (!trimmed && !mediaUrl) return { ok: false, error: "empty" };
  if (trimmed.length > 2000) return { ok: false, error: "too_long" };
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: trimmed,
      media_url: mediaUrl ?? null,
    })
    .select("id,sender_id,body,created_at,media_url")
    .single();
  if (error) {
    // 42501 = the restrictive request gate (or the block policy) refused the
    // write. Translate it rather than leaking a raw policy string to the UI.
    return { ok: false, error: error.code === "42501" ? "not_writable" : error.message };
  }
  revalidatePath(`/messages/${conversationId}`);
  return {
    ok: true,
    message: {
      id: data.id,
      senderId: data.sender_id,
      body: data.body,
      createdAt: data.created_at,
      mediaUrl: data.media_url ?? null,
    },
  };
}

/**
 * Accept or decline a cold DM. All authority checks (party, not-the-initiator,
 * still-pending) live in the security-definer RPC; this is the call site.
 */
export async function resolveMessageRequest(
  conversationId: string,
  accept: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("resolve_message_request", {
    target_conversation: conversationId,
    accept,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  return { ok: true };
}

/** One reaction per person per message; passing null clears mine. */
export async function setMessageReaction(
  messageId: string,
  emoji: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  if (emoji === null) {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("profile_id", user.id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  if (!isMessageReactionEmoji(emoji)) return { ok: false, error: "unsupported_emoji" };
  const { error } = await supabase
    .from("message_reactions")
    .upsert(
      { message_id: messageId, profile_id: user.id, emoji },
      { onConflict: "message_id,profile_id" },
    );
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Record that I have opened this thread. Written unconditionally — the
 * show_read_receipts switch governs DISPLAY, not collection, so flipping it
 * back on does not leave a hole in your own read state.
 */
export async function markConversationRead(
  conversationId: string,
): Promise<{ ok: boolean }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("conversation_reads")
    .upsert(
      {
        conversation_id: conversationId,
        profile_id: user.id,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id,profile_id" },
    );
  return { ok: !error };
}

/** The reciprocal receipts switch: off means I neither send nor see receipts. */
export async function setReadReceipts(enabled: boolean): Promise<{ ok: boolean }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ show_read_receipts: enabled })
    .eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/messages");
  return { ok: true };
}
