"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { sendMessage } from "@/lib/messaging/actions";
import type { ThreadMessage } from "@/lib/messaging/queries";
import { Button } from "@/components/ui/button";

export function MessageThread({
  conversationId,
  meId,
  initial,
}: {
  conversationId: string;
  meId: string;
  initial: ThreadMessage[];
}) {
  const t = useTranslations("messages");
  const [items, setItems] = useState<ThreadMessage[]>(initial);
  const [body, setBody] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`conv:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as {
            id: string;
            sender_id: string;
            body: string;
            created_at: string;
          };
          setItems((prev) =>
            prev.some((x) => x.id === m.id)
              ? prev
              : [...prev, { id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at }],
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body;
    setBody("");
    const res = await sendMessage(conversationId, text);
    if (res.ok) {
      // Append immediately (don't wait for the Realtime echo); subscription dedupes by id.
      setItems((prev) =>
        prev.some((x) => x.id === res.message.id) ? prev : [...prev, res.message],
      );
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="message-thread">
      <div className="flex flex-col gap-2">
        {items.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              m.senderId === meId
                ? "self-end bg-primary text-primary-foreground"
                : "self-start bg-card"
            }`}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          data-testid="message-input"
          className="flex-1 rounded border border-input bg-transparent p-2"
        />
        <Button type="submit" data-testid="message-send" disabled={!body.trim()}>
          {t("send")}
        </Button>
      </form>
    </div>
  );
}
