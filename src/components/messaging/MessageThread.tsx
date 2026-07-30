"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { markConversationRead, sendMessage } from "@/lib/messaging/actions";
import type { ThreadMessage } from "@/lib/messaging/queries";
import type { MessageContext } from "@/lib/messaging/context";
import { isVideoUrl } from "@/lib/media/media-kind";
import { Button } from "@/components/ui/button";
import { MediaInput } from "@/components/compose/MediaInput";
import { MessageContextPill } from "./MessageContextPill";
import { MessageReactions } from "./MessageReactions";
import { MessageRequestActions } from "./MessageRequestActions";

export type ThreadGate = {
  status: "active" | "request" | "declined";
  /** True when I am the one who knocked. */
  iInitiated: boolean;
};

export function MessageThread({
  conversationId,
  meId,
  initial,
  contexts = [],
  gate,
  otherName,
  otherLastReadAt = null,
}: {
  conversationId: string;
  meId: string;
  initial: ThreadMessage[];
  contexts?: MessageContext[];
  gate: ThreadGate;
  otherName: string;
  /** Null whenever either party has receipts off — receipts are reciprocal. */
  otherLastReadAt?: string | null;
}) {
  const t = useTranslations("messages");
  const [items, setItems] = useState<ThreadMessage[]>(initial);
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // I am the addressee of an unanswered knock: no composer until I answer.
  const awaitingMyAnswer = gate.status === "request" && !gate.iInitiated;
  const canWrite = gate.status === "active" || (gate.status === "request" && gate.iInitiated);

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
            media_url: string | null;
          };
          setItems((prev) =>
            prev.some((x) => x.id === m.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: m.id,
                    senderId: m.sender_id,
                    body: m.body,
                    createdAt: m.created_at,
                    mediaUrl: m.media_url ?? null,
                    reactions: [],
                  },
                ],
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

  // Read state is recorded whatever the receipts switch says — the switch
  // governs display, not collection.
  useEffect(() => {
    if (gate.status !== "active") return;
    void markConversationRead(conversationId);
  }, [conversationId, gate.status, items.length]);

  // The last thing I sent that they have now opened, so "Seen" lands on one
  // message rather than every one of mine.
  const lastSeenMineId = otherLastReadAt
    ? (items.filter((m) => m.senderId === meId && m.createdAt <= otherLastReadAt).at(-1)?.id ??
      null)
    : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body;
    const media = mediaUrl;
    setBody("");
    setMediaUrl(null);
    setError(null);
    const res = await sendMessage(conversationId, text, media);
    if (res.ok) {
      // Append immediately (don't wait for the Realtime echo); subscription dedupes by id.
      setItems((prev) =>
        prev.some((x) => x.id === res.message.id)
          ? prev
          : [...prev, { ...res.message, reactions: [] }],
      );
      return;
    }
    setBody(text);
    setMediaUrl(media);
    setError(res.error === "not_writable" ? t("sendBlocked") : t("sendFailed"));
  }

  return (
    <div className="flex flex-col gap-3" data-testid="message-thread">
      {contexts.length > 0 && (
        <section
          className="flex flex-col gap-2"
          aria-label={t("listingContexts")}
          data-testid="message-contexts"
        >
          {contexts.map((context) => (
            <MessageContextPill key={context.id} context={context} />
          ))}
        </section>
      )}

      {awaitingMyAnswer && (
        <section
          className="flex flex-col gap-3 rounded-xl border border-input p-3"
          aria-label={t("requestBannerTitle")}
          data-testid="message-request-banner"
        >
          <div>
            <p className="text-sm font-medium">{t("requestBannerTitle")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("requestBannerHelp")}</p>
          </div>
          <MessageRequestActions conversationId={conversationId} senderName={otherName} />
        </section>
      )}

      <div className="flex flex-col gap-2">
        {items.map((m) => (
          <div
            key={m.id}
            className={`flex max-w-[80%] flex-col ${m.senderId === meId ? "self-end items-end" : "self-start items-start"}`}
            data-testid="message-row"
          >
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                m.senderId === meId ? "bg-primary text-primary-foreground" : "bg-card"
              }`}
            >
              {m.body}
              {m.mediaUrl &&
                (isVideoUrl(m.mediaUrl) ? (
                  <video
                    src={m.mediaUrl}
                    controls
                    muted
                    playsInline
                    className="mt-2 max-h-60 w-full rounded-md bg-black"
                    data-testid="message-media-video"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.mediaUrl}
                    alt={t("attachmentAlt")}
                    className="mt-2 max-h-60 w-full rounded-md object-cover"
                    data-testid="message-media"
                  />
                ))}
            </div>
            <MessageReactions messageId={m.id} initial={m.reactions} />
            {m.id === lastSeenMineId && (
              <p className="text-xs text-muted-foreground" data-testid="read-receipt">
                {t("seen")}
              </p>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {gate.status === "declined" && (
        <p className="rounded-xl border border-input p-3 text-sm text-muted-foreground" data-testid="thread-declined">
          {t("declinedNotice")}
        </p>
      )}

      {gate.status === "request" && gate.iInitiated && (
        <p className="rounded-xl border border-input p-3 text-sm text-muted-foreground" data-testid="thread-pending">
          {t("pendingNotice", { name: otherName })}
        </p>
      )}

      {canWrite && (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              data-testid="message-input"
              className="flex-1 rounded border border-input bg-transparent p-2"
            />
            <Button
              type="submit"
              data-testid="message-send"
              disabled={!body.trim() && !mediaUrl}
            >
              {t("send")}
            </Button>
          </div>
          {/* Reuses the compose picker + shared upload util — one uploader in
              the app, EXIF-stripping and size caps included. */}
          <MediaInput userId={meId} onUploaded={(url) => setMediaUrl(url)} />
          {error && (
            <p className="text-sm text-destructive" role="alert" data-testid="message-error">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
