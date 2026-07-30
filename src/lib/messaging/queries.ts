import { createClient } from "@/lib/supabase/server";

export type InboxRow = {
  id: string;
  otherUsername: string;
  otherDisplayName: string | null;
  lastBody: string | null;
  lastAt: string | null;
  /** True while my own outbound knock is still awaiting the addressee's answer. */
  pending: boolean;
};

/**
 * The MAIN inbox. Only conversations the viewer has actually consented to,
 * plus their own still-pending outbound knocks.
 *
 * A `request` addressed TO the viewer belongs in getMessageRequests, and a
 * `declined` conversation belongs nowhere — RLS still lets a participant read
 * the message rows (they are a party to the conversation), so the guarantee
 * that a declined opener never reaches the main inbox is this filter's job.
 */
export async function getInbox(userId: string): Promise<InboxRow[]> {
  const supabase = await createClient();
  const { data: convs } = await supabase
    .from("conversations")
    .select("id,user_a,user_b,status,initiated_by")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .in("status", ["active", "request"]);
  const visible = (convs ?? []).filter(
    (c) => c.status === "active" || c.initiated_by === userId,
  );
  if (!visible.length) return [];
  const otherIds = visible.map((c) => (c.user_a === userId ? c.user_b : c.user_a));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,username,display_name")
    .in("id", otherIds);
  const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const rows: InboxRow[] = [];
  // N+1 last-message lookup — fine at demo scale; swap for a view/RPC when inboxes grow.
  for (const c of visible) {
    const otherId = c.user_a === userId ? c.user_b : c.user_a;
    const p = pMap.get(otherId);
    const { data: last } = await supabase
      .from("messages")
      .select("body,created_at")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    rows.push({
      id: c.id,
      otherUsername: p?.username ?? "unknown",
      otherDisplayName: p?.display_name ?? null,
      lastBody: last?.body ?? null,
      lastAt: last?.created_at ?? null,
      pending: c.status === "request",
    });
  }
  return rows.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

export type MessageRequestRow = {
  id: string;
  fromUsername: string;
  fromDisplayName: string | null;
  preview: string | null;
  sentAt: string | null;
};

/**
 * Cold DMs waiting on the viewer's answer. The opener body IS shown here —
 * that is the whole point of a request inbox, you decide on the knock — but it
 * lives on this separate surface until accepted, and vanishes on decline.
 */
export async function getMessageRequests(userId: string): Promise<MessageRequestRow[]> {
  const supabase = await createClient();
  const { data: convs } = await supabase
    .from("conversations")
    .select("id,user_a,user_b,initiated_by")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq("status", "request");
  const incoming = (convs ?? []).filter((c) => c.initiated_by !== userId);
  if (!incoming.length) return [];
  const senderIds = incoming.map((c) => c.initiated_by ?? (c.user_a === userId ? c.user_b : c.user_a));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,username,display_name")
    .in("id", senderIds);
  const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const rows: MessageRequestRow[] = [];
  for (const c of incoming) {
    const senderId = c.initiated_by ?? (c.user_a === userId ? c.user_b : c.user_a);
    const p = pMap.get(senderId);
    const { data: first } = await supabase
      .from("messages")
      .select("body,created_at")
      .eq("conversation_id", c.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    rows.push({
      id: c.id,
      fromUsername: p?.username ?? "unknown",
      fromDisplayName: p?.display_name ?? null,
      preview: first?.body ?? null,
      sentAt: first?.created_at ?? null,
    });
  }
  return rows.sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
}

export type MessageReaction = { emoji: string; mine: boolean };

export type ThreadMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  mediaUrl: string | null;
  reactions: MessageReaction[];
};

export async function getThread(
  conversationId: string,
  meId: string,
): Promise<ThreadMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id,sender_id,body,created_at,media_url")
    .eq("conversation_id", conversationId)
    .order("created_at");
  const messages = data ?? [];
  if (!messages.length) return [];
  const { data: reactions } = await supabase
    .from("message_reactions")
    .select("message_id,profile_id,emoji")
    .in(
      "message_id",
      messages.map((m) => m.id),
    );
  const byMessage = new Map<string, MessageReaction[]>();
  for (const r of reactions ?? []) {
    const list = byMessage.get(r.message_id) ?? [];
    list.push({ emoji: r.emoji, mine: r.profile_id === meId });
    byMessage.set(r.message_id, list);
  }
  return messages.map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    body: m.body,
    createdAt: m.created_at,
    mediaUrl: m.media_url ?? null,
    reactions: byMessage.get(m.id) ?? [],
  }));
}

export type ConversationState = {
  userA: string;
  userB: string;
  status: "active" | "request" | "declined";
  initiatedBy: string | null;
};

export async function getConversationParticipants(
  conversationId: string,
): Promise<ConversationState | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("user_a,user_b,status,initiated_by")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data) return null;
  return {
    userA: data.user_a,
    userB: data.user_b,
    status: data.status,
    initiatedBy: data.initiated_by ?? null,
  };
}

export async function getOtherParticipantProfile(conversationId: string, meId: string) {
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("user_a,user_b")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return null;
  const otherId = conv.user_a === meId ? conv.user_b : conv.user_a;
  const { data: p } = await supabase
    .from("profiles")
    .select("username,display_name")
    .eq("id", otherId)
    .maybeSingle();
  return p;
}

export type ReceiptState = {
  /** My own switch — also decides whether I get to SEE anyone else's receipts. */
  mine: boolean;
  /** The other party's switch. */
  theirs: boolean;
  /** When they last opened this thread; null when either side has receipts off. */
  otherLastReadAt: string | null;
};

/**
 * Receipts are RECIPROCAL: turning yours off hides theirs from you too.
 * Both switches must be on before either timestamp is disclosed, so the
 * feature can never become one-way surveillance.
 */
export async function getReceiptState(
  conversationId: string,
  meId: string,
): Promise<ReceiptState> {
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("user_a,user_b")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return { mine: true, theirs: false, otherLastReadAt: null };
  const otherId = conv.user_a === meId ? conv.user_b : conv.user_a;
  const { data: prefs } = await supabase
    .from("profiles")
    .select("id,show_read_receipts")
    .in("id", [meId, otherId]);
  const mine = prefs?.find((p) => p.id === meId)?.show_read_receipts ?? true;
  const theirs = prefs?.find((p) => p.id === otherId)?.show_read_receipts ?? true;
  if (!mine || !theirs) return { mine, theirs, otherLastReadAt: null };
  const { data: read } = await supabase
    .from("conversation_reads")
    .select("last_read_at")
    .eq("conversation_id", conversationId)
    .eq("profile_id", otherId)
    .maybeSingle();
  return { mine, theirs, otherLastReadAt: read?.last_read_at ?? null };
}

export async function getMyReceiptSetting(meId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("show_read_receipts")
    .eq("id", meId)
    .maybeSingle();
  return data?.show_read_receipts ?? true;
}
