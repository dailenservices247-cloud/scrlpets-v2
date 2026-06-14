import { createClient } from "@/lib/supabase/server";

export type InboxRow = {
  id: string;
  otherUsername: string;
  otherDisplayName: string | null;
  lastBody: string | null;
  lastAt: string | null;
};

export async function getInbox(userId: string): Promise<InboxRow[]> {
  const supabase = await createClient();
  const { data: convs } = await supabase
    .from("conversations")
    .select("id,user_a,user_b")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  if (!convs?.length) return [];
  const otherIds = convs.map((c) => (c.user_a === userId ? c.user_b : c.user_a));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,username,display_name")
    .in("id", otherIds);
  const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const rows: InboxRow[] = [];
  // N+1 last-message lookup — fine at demo scale; swap for a view/RPC when inboxes grow.
  for (const c of convs) {
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
    });
  }
  return rows.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

export type ThreadMessage = { id: string; senderId: string; body: string; createdAt: string };

export async function getThread(conversationId: string): Promise<ThreadMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id,sender_id,body,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at");
  return (data ?? []).map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    body: m.body,
    createdAt: m.created_at,
  }));
}

export async function getConversationParticipants(conversationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("user_a,user_b")
    .eq("id", conversationId)
    .maybeSingle();
  return data;
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
