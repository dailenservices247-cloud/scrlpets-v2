"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { markConversationRead, sendMessage } from "@/lib/messaging/actions";
import type { ThreadMessage } from "@/lib/messaging/queries";
import type { MessageContext } from "@/lib/messaging/context";
import { isVideoUrl, isAudioUrl } from "@/lib/media/media-kind";
import { Button } from "@/components/ui/button";
import { MediaInput } from "@/components/compose/MediaInput";
import { VoiceNotePlayer } from "./VoiceNotePlayer";
import { VoiceNoteRecorder } from "./VoiceNoteRecorder";
import { VaultDocumentCard } from "@/components/vault/VaultDocumentCard";
import { DocumentVaultDrawer } from "@/components/vault/DocumentVaultDrawer";
import { encodeVaultDocumentMessage, parseVaultDocumentMessage } from "@/lib/vault/documents";
import { FolderOpen, X } from "lucide-react";
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // I am the addressee of an unanswered knock: no composer until I answer.
  const awaitingMyAnswer = gate.status === "request" && !gate.iInitiated;
  const canWrite = gate.status === "active" || (gate.status === "request" && gate.iInitiated);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`conv:${conversationId}`);

    ch.on(
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
    );

    ch.on(
      "broadcast",
      { event: "typing" },
      (payload: { type: "broadcast"; event: string; payload?: { userId: string; isTyping: boolean } }) => {
        if (payload.payload && payload.payload.userId !== meId) {
          setIsOtherTyping(Boolean(payload.payload.isTyping));
        }
      },
    );

    ch.subscribe();

    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [conversationId, meId]);

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
  const latestMineId = items.filter((m) => m.senderId === meId).at(-1)?.id ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (channelRef.current) {
      void channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: meId, isTyping: false },
      });
    }
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
            {(() => {
              const vaultDoc = parseVaultDocumentMessage(m.body);
              if (vaultDoc) {
                return (
                  <VaultDocumentCard
                    title={vaultDoc.title}
                    category={vaultDoc.category}
                    species={vaultDoc.species}
                    fileUrl={vaultDoc.fileUrl}
                    isMine={m.senderId === meId}
                  />
                );
              }
              return (
                <div
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.senderId === meId ? "bg-primary text-primary-foreground" : "bg-card"
                  }`}
                >
                  {m.body && <p>{m.body}</p>}
                  {m.mediaUrl &&
                    (isAudioUrl(m.mediaUrl) ? (
                      <VoiceNotePlayer src={m.mediaUrl} isMine={m.senderId === meId} />
                    ) : isVideoUrl(m.mediaUrl) ? (
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
                        onClick={() => setLightboxUrl(m.mediaUrl)}
                        className="mt-2 max-h-60 w-full cursor-pointer rounded-md object-cover transition hover:opacity-95"
                        data-testid="message-media"
                      />
                    ))}
                </div>
              );
            })()}
            <MessageReactions messageId={m.id} initial={m.reactions} />
            {m.id === lastSeenMineId ? (
              <p className="text-xs text-muted-foreground" data-testid="read-receipt">
                {t("seen")}
              </p>
            ) : m.senderId === meId && m.id === latestMineId ? (
              <p className="text-xs text-muted-foreground/75" data-testid="delivery-status">
                {t("delivered")}
              </p>
            ) : null}
          </div>
        ))}
        {isOtherTyping && (
          <div
            className="flex items-center gap-2 pl-2 text-xs text-muted-foreground"
            data-testid="typing-indicator"
          >
            <span className="size-2 rounded-full bg-brand-link opacity-75" />
            <span>
              {otherName} {t("isTyping")}
            </span>
          </div>
        )}
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
          {mediaUrl && (
            <div className="relative inline-block w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl}
                alt="Attachment preview"
                className="h-16 w-16 rounded-xl object-cover border border-primary/40 shadow-sm"
              />
              <button
                type="button"
                onClick={() => setMediaUrl(null)}
                className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold shadow hover:opacity-90"
                aria-label="Remove attachment"
              >
                &times;
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                if (channelRef.current) {
                  void channelRef.current.send({
                    type: "broadcast",
                    event: "typing",
                    payload: { userId: meId, isTyping: true },
                  });
                }
                if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                typingTimerRef.current = setTimeout(() => {
                  if (channelRef.current) {
                    void channelRef.current.send({
                      type: "broadcast",
                      event: "typing",
                      payload: { userId: meId, isTyping: false },
                    });
                  }
                }, 2500);
              }}
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
          <div className="flex items-center gap-2">
            <MediaInput userId={meId} onUploaded={(url) => setMediaUrl(url)} />
            <VoiceNoteRecorder
              userId={meId}
              onVoiceNoteUploaded={async (url) => {
                const res = await sendMessage(conversationId, "", url);
                if ("error" in res) setError(res.error);
              }}
            />
            <button
              type="button"
              onClick={() => setIsVaultOpen(true)}
              className="grid size-9 place-items-center rounded-xl border border-input text-muted-foreground transition hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
              title="Attach document from Vault"
              aria-label="Attach document from Vault"
              data-testid="message-vault-btn"
            >
              <FolderOpen className="size-4" />
            </button>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert" data-testid="message-error">
              {error}
            </p>
          )}
        </form>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
          data-testid="message-media-lightbox"
        >
          <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 grid size-8 place-items-center rounded-full bg-background text-foreground border border-border shadow-lg hover:bg-muted"
              aria-label="Close full view"
            >
              <X className="size-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Full size media preview"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      <DocumentVaultDrawer
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        onSelectDocument={async (doc) => {
          setIsVaultOpen(false);
          const encoded = encodeVaultDocumentMessage(doc);
          const res = await sendMessage(conversationId, encoded, null);
          if ("error" in res) setError(res.error);
        }}
      />
    </div>
  );
}
