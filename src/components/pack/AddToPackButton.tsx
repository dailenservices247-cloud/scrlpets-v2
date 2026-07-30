"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { sendPackRequest } from "@/lib/pack/actions";

/**
 * The entry point into the pack graph. Everything else about Pack — the
 * requests list, accept/decline, the notification — only ever fires because
 * someone pressed this; without it the whole surface is decorative.
 *
 * Deliberately does not pretend to know the current link state: reading it
 * would cost a query on every profile view, and the unique pair index already
 * makes a second press honest rather than duplicating anything.
 */
export function AddToPackButton({ profileId }: { profileId: string }) {
  const t = useTranslations("pack");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "linked" | "error">("idle");

  async function send() {
    setState("busy");
    const result = await sendPackRequest(profileId);
    if (result.ok) return setState("sent");
    setState(result.error === "already_linked" ? "linked" : "error");
  }

  if (state === "sent" || state === "linked") {
    return (
      <p className="text-xs text-muted-foreground" data-testid="pack-request-state">
        {state === "sent" ? t("requestSent") : t("requestAlready")}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={send}
        disabled={state === "busy"}
        data-testid="add-to-pack"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-input px-3 text-sm font-medium disabled:opacity-60"
      >
        <UserPlus aria-hidden className="size-4" />
        {state === "busy" ? t("requestSending") : t("addToPack")}
      </button>
      {state === "error" && (
        <p className="text-xs text-destructive" role="alert">
          {t("error")}
        </p>
      )}
    </div>
  );
}
