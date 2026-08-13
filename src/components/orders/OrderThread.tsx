"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { postOrderMessage, type OrderMessage } from "@/lib/orders/thread";

/**
 * Three people talking about one animal.
 *
 * Every message carries the sender's ROLE, not just their name. In a dispute the
 * difference between "the seller said the van was late" and "the driver said the
 * van was late" is the whole point, and a username alone does not carry it —
 * especially months later, read by someone who was not there.
 */
export function OrderThread({
  orderId,
  messages,
  viewerId,
  hasTransporter,
}: {
  orderId: string;
  messages: OrderMessage[];
  viewerId: string;
  hasTransporter: boolean;
}) {
  const t = useTranslations("orderThread");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const result = await postOrderMessage(orderId, body);
    setBusy(false);
    if (!result.ok) {
      setError(
        result.error.includes("not_a_party")
          ? t("errorNotAParty")
          : result.error.includes("account_suspended")
            ? t("errorSuspended")
            : t("errorGeneric"),
      );
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3" data-testid="order-thread">
      <p className="text-xs text-muted-foreground" data-testid="thread-who">
        {hasTransporter ? t("whoThree") : t("whoTwo")}
      </p>

      {messages.length === 0 ? (
        <p className="premium-panel rounded-2xl p-4 text-sm text-muted-foreground" data-testid="thread-empty">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="thread-messages">
          {messages.map((m) => (
            <li
              key={m.id}
              className="premium-panel rounded-2xl p-3"
              data-testid={`thread-message-${m.id}`}
            >
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">{m.senderUsername ?? t("someone")}</span>
                {" · "}
                {/* The role, always. A dispute read months later needs to know
                    WHICH party said a thing, not only who. */}
                <span data-testid={`thread-role-${m.id}`}>{t(`role.${m.senderRole}`)}</span>
                {m.senderId === viewerId && ` · ${t("you")}`}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          className="min-h-20 rounded-xl border border-input bg-transparent p-2 text-sm"
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          data-testid="thread-input"
        />
        <Button
          type="button"
          onClick={send}
          disabled={busy || body.trim() === ""}
          data-testid="thread-send"
        >
          {busy ? t("sending") : t("send")}
        </Button>
        {/* Said once, plainly: this is evidence, and it cannot be edited away. */}
        <p className="text-xs text-muted-foreground">{t("permanentNote")}</p>
      </div>

      {error && (
        <p className="text-sm text-destructive" data-testid="thread-error">
          {error}
        </p>
      )}
    </section>
  );
}
