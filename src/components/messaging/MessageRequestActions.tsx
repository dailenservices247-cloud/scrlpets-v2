"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { resolveMessageRequest } from "@/lib/messaging/actions";
import { Button } from "@/components/ui/button";

/**
 * Accept or decline a cold DM. Declining takes the conversation to `declined`,
 * which drops it out of every inbox surface — the opener body never lands in
 * the main thread list.
 */
export function MessageRequestActions({
  conversationId,
  senderName,
}: {
  conversationId: string;
  senderName: string;
}) {
  const t = useTranslations("messages");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function resolve(accept: boolean) {
    setBusy(true);
    setError(false);
    const result = await resolveMessageRequest(conversationId, accept);
    setBusy(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2" data-testid="message-request-actions">
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={busy}
          onClick={() => resolve(true)}
          data-testid="accept-request"
        >
          {t("acceptRequest")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => resolve(false)}
          data-testid="decline-request"
        >
          {t("declineRequest")}
        </Button>
      </div>
      <p className="sr-only">{t("requestFrom", { name: senderName })}</p>
      {error && (
        <p className="text-sm text-destructive" role="alert" data-testid="request-error">
          {t("requestError")}
        </p>
      )}
    </div>
  );
}
