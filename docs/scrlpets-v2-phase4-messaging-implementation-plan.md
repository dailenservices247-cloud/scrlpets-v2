# Scrlpets v2 — Phase 4 (Messaging / DMs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Signed-in users send 1:1 direct messages (start a thread from any profile, send/receive text). Foundation for buyer-seller comms — the trust layer that lands BEFORE marketplace per the locked sequence. Real-time delivery via Supabase Realtime.

**Architecture:** Two tables — `conversations` (a pair of participants, deduped) + `messages` (text, sender, timestamp). RLS so only the two participants can read/write a conversation. Sending = server action (sender = session user, enforced). Live updates = Supabase Realtime channel subscription on the client thread view. Inbox at `/messages`, thread at `/messages/[conversationId]`, "Message" button on profiles. i18n EN+ES, axe gates — riders continue.

**Trust-seam note (§0.5 rule 2):** these become the "immutable message logs" surface at the marketplace phase. Build the schema append-only-friendly now (no UPDATE/DELETE policy on messages — slice ships read+insert only); the hash-chain/erasure layer (G7) grafts on at phase 5, not here. Don't hardwire it; just don't design it out.

**Tech Stack:** existing stack only (Supabase Realtime is built into `@supabase/supabase-js`).

**Scope locks (2026-06-12):** group threads, media in messages, read receipts, typing indicators, message edit/delete, block/report, push notifications = OUT (banked). Text 1:1 only.

---

## PREREQUISITES
- [ ] **P1 — Realtime enabled** on the dev project for the `messages` table. Engineer enables via MCP `execute_sql` (`alter publication supabase_realtime add table public.messages;`) in Task 1. No Dailen action.

---

## FILE STRUCTURE
```
src/
├── lib/messaging/
│   ├── queries.ts       # getInbox, getThread, getOrCreateConversation (new)
│   └── actions.ts       # "use server" sendMessage, startConversation (new)
├── app/
│   ├── messages/page.tsx              # inbox list (new)
│   └── messages/[id]/page.tsx         # thread view (new)
├── components/messaging/
│   ├── MessageThread.tsx   # client: live messages + composer (new)
│   └── MessageButton.tsx   # client: "Message" on a profile (new)
└── middleware.ts           # gate /messages (modify)
supabase-dev/phase4-messaging.sql      # tables + RLS + realtime (new, MCP-applied)
messages/{en,es}.json                  # +messages.* keys (modify)
tests/e2e/messaging.spec.ts            # (new)
tests/e2e/a11y.spec.ts                 # +inbox gate (modify)
```

---

## Task 1: Schema — conversations + messages + RLS + realtime

- [ ] **Step 1:** `supabase-dev/phase4-messaging.sql`:

```sql
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- canonical pair ordering so (a,b) == (b,a) dedupes via unique index
  constraint conv_order check (user_a < user_b),
  unique (user_a, user_b)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index messages_conv_created on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- participants only
create policy "conv participant read" on public.conversations
  for select to authenticated using (auth.uid() in (user_a, user_b));
create policy "conv participant insert" on public.conversations
  for insert to authenticated with check (auth.uid() in (user_a, user_b));

create policy "msg participant read" on public.messages
  for select to authenticated using (
    exists (select 1 from public.conversations c
            where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)));
-- insert: sender is self AND a participant of the conversation
create policy "msg participant insert" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)));
-- NO update/delete policy → messages are append-only (trust-log seam for phase 5)

alter publication supabase_realtime add table public.messages;
```

- [ ] **Step 2:** Apply via MCP `apply_migration` (name `phase4_messaging`) to `irpayabloogarxwtjmrf`.
- [ ] **Step 3:** Verify: MCP `execute_sql` → `select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='messages';` returns one row; 4 policies present.
- [ ] **Step 4:** Commit `supabase-dev/phase4-messaging.sql`.

## Task 2: i18n keys (EN+ES)

- [ ] Add `messages` block to `messages/en.json`:

```json
"messages": {
  "title": "Messages", "empty": "No conversations yet.",
  "message": "Message", "placeholder": "Write a message…",
  "send": "Send", "you": "You", "back": "Back"
}
```

- [ ] `messages/es.json` mirror: `"title": "Mensajes", "empty": "Aún no hay conversaciones.", "message": "Mensaje", "placeholder": "Escribe un mensaje…", "send": "Enviar", "you": "Tú", "back": "Atrás"`.
- [ ] Commit.

## Task 3: Query module + actions

- [ ] `src/lib/messaging/queries.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export type InboxRow = {
  id: string; otherUsername: string; otherDisplayName: string | null;
  lastBody: string | null; lastAt: string | null;
};

export async function getInbox(userId: string): Promise<InboxRow[]> {
  const supabase = await createClient();
  const { data: convs } = await supabase
    .from("conversations").select("id,user_a,user_b")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  if (!convs?.length) return [];
  const otherIds = convs.map((c) => (c.user_a === userId ? c.user_b : c.user_a));
  const { data: profiles } = await supabase
    .from("profiles").select("id,username,display_name").in("id", otherIds);
  const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const rows: InboxRow[] = [];
  for (const c of convs) {
    const otherId = c.user_a === userId ? c.user_b : c.user_a;
    const p = pMap.get(otherId);
    const { data: last } = await supabase
      .from("messages").select("body,created_at")
      .eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    rows.push({
      id: c.id, otherUsername: p?.username ?? "unknown", otherDisplayName: p?.display_name ?? null,
      lastBody: last?.body ?? null, lastAt: last?.created_at ?? null,
    });
  }
  return rows.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

export type ThreadMessage = { id: string; senderId: string; body: string; createdAt: string };

export async function getThread(conversationId: string): Promise<ThreadMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages").select("id,sender_id,body,created_at")
    .eq("conversation_id", conversationId).order("created_at");
  return (data ?? []).map((m) => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at }));
}

export async function getConversationParticipants(conversationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations").select("user_a,user_b").eq("id", conversationId).maybeSingle();
  return data;
}
```

- [ ] `src/lib/messaging/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("auth_required");
  return { supabase, user };
}

/** Returns the conversation id for the pair, creating it if needed. otherUserId != self. */
export async function startConversation(otherUserId: string): Promise<{ id: string } | { error: string }> {
  const { supabase, user } = await requireUser();
  if (otherUserId === user.id) return { error: "self" };
  const [a, b] = [user.id, otherUserId].sort();
  const { data: existing } = await supabase
    .from("conversations").select("id").eq("user_a", a).eq("user_b", b).maybeSingle();
  if (existing) return { id: existing.id };
  const { data, error } = await supabase
    .from("conversations").insert({ user_a: a, user_b: b }).select("id").single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function sendMessage(conversationId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  if (trimmed.length > 2000) return { ok: false, error: "too_long" };
  const { error } = await supabase
    .from("messages").insert({ conversation_id: conversationId, sender_id: user.id, body: trimmed });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/messages/${conversationId}`);
  return { ok: true };
}
```

- [ ] tsc clean → commit.

## Task 4: MessageButton + MessageThread components

- [ ] `MessageButton.tsx` (client): calls `startConversation(profileId)` → `router.push('/messages/'+id)`.

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { startConversation } from "@/lib/messaging/actions";

export function MessageButton({ profileId }: { profileId: string }) {
  const t = useTranslations("messages");
  const router = useRouter();
  async function go() {
    const res = await startConversation(profileId);
    if ("id" in res) router.push(`/messages/${res.id}`);
  }
  return (
    <button onClick={go} data-testid="message-button"
      className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">
      {t("message")}
    </button>
  );
}
```

- [ ] `MessageThread.tsx` (client): renders initial messages, subscribes to Realtime inserts on this conversation, composer posts via `sendMessage`.

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { sendMessage } from "@/lib/messaging/actions";
import type { ThreadMessage } from "@/lib/messaging/queries";
import { Button } from "@/components/ui/button";

export function MessageThread({
  conversationId, meId, initial,
}: { conversationId: string; meId: string; initial: ThreadMessage[] }) {
  const t = useTranslations("messages");
  const [items, setItems] = useState<ThreadMessage[]>(initial);
  const [body, setBody] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`conv:${conversationId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as { id: string; sender_id: string; body: string; created_at: string };
          setItems((prev) => prev.some((x) => x.id === m.id) ? prev
            : [...prev, { id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at }]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [items]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body;
    setBody("");
    await sendMessage(conversationId, text);
  }

  return (
    <div className="flex flex-col gap-3" data-testid="message-thread">
      <div className="flex flex-col gap-2">
        {items.map((m) => (
          <div key={m.id}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              m.senderId === meId ? "self-end bg-primary text-primary-foreground" : "self-start bg-card"}`}>
            {m.body}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("placeholder")}
          aria-label={t("placeholder")} data-testid="message-input"
          className="flex-1 rounded border border-input bg-transparent p-2" />
        <Button type="submit" data-testid="message-send" disabled={!body.trim()}>{t("send")}</Button>
      </form>
    </div>
  );
}
```

- [ ] tsc clean → commit.

## Task 5: Pages + wiring + middleware

- [ ] `/messages/page.tsx` (RSC, gated): inbox list from `getInbox`; each row links `/messages/[id]`; empty state.
- [ ] `/messages/[id]/page.tsx` (RSC, gated): verify session user is a participant (`getConversationParticipants`; `notFound()` if not) → render `MessageThread` with `getThread` initial + a header with the other user's @username + back link.
- [ ] Add `MessageButton` to `ProfileHeader` when viewing someone else's profile (`!isOwn`), next to nothing-or-edit.
- [ ] Add a "Messages" link in the home header for signed-in users (small, next to the compose `+`).
- [ ] Middleware: gate `/messages`.
- [ ] Manual verify (two browser profiles or two accounts): A messages B → B sees it live without refresh.
- [ ] tsc clean → commit.

## Task 6: Tests

- [ ] `tests/e2e/messaging.spec.ts`: signed-out `/messages` → `/login`; signed-in inbox renders; from a profile, click Message → thread opens; send a message → appears in thread; reload → persists. (Single-user covers send+persist+gate; cross-user realtime verified manually — note in test file.)
- [ ] `a11y.spec.ts`: + `/messages` gate (sign in first).
- [ ] Full suites green (serial, workers=1) → commit.

## Task 7: Deploy + smoke + docs

- [ ] `npm run build` green → push → `npx vercel deploy --prod --yes`.
- [ ] Smoke: sign in → open a profile → Message → send → reload persists.
- [ ] Clean any E2E message rows from dev DB via MCP.
- [ ] Update handoff + relay + copy plan to `docs/`.

## Self-Review
- Parity step 4 (messaging before marketplace) ✓. 1:1 text only; group/media/receipts/typing/block/push banked ✓. Participant-only RLS, sender-enforced insert ✓. Append-only messages = trust-log seam for phase 5 (G7 grafts later, not designed out) ✓. Realtime live delivery ✓. i18n + axe riders ✓. Deploy via CLI (GitHub auto-deploy blocked) ✓. Types consistent (ThreadMessage/InboxRow used across queries↔components).
- **Honest caveat:** `getInbox` does one last-message query per conversation (N+1) — fine at demo scale, flag for a view/RPC when inboxes grow. Logged, not solved (YAGNI now).
