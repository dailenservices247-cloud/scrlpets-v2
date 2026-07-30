"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Share2 } from "lucide-react";

/**
 * Copy, plus the OS share sheet where the browser has one. `navigator.share`
 * is absent on most desktops and throws on cancel, so the button only appears
 * once it is known to exist and a cancelled share is not treated as a failure.
 */
export function ShareActions({ text }: { text: string }) {
  const t = useTranslations("referrals");
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard needs a secure context and can be denied. The message is
      // already on screen and selectable, so there is nothing to recover.
    }
  }

  async function share() {
    try {
      await navigator.share({ text });
    } catch {
      // Includes the user simply dismissing the sheet — not an error.
    }
  }

  return (
    <div className="mt-3 flex gap-2">
      <button
        type="button"
        onClick={copy}
        data-testid="referral-share-copy"
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link"
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? t("copied") : t("copyMessage")}
      </button>
      {canShare && (
        <button
          type="button"
          onClick={share}
          data-testid="referral-share-native"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-input px-4 text-sm font-medium"
        >
          <Share2 className="size-4" aria-hidden />
          {t("shareButton")}
        </button>
      )}
    </div>
  );
}
