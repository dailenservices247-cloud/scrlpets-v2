"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import type { ReferralStats } from "@/lib/referrals/queries";

/**
 * The copy here is deliberately unexciting. Legacy paid on signup, so its
 * invite screen could promise points for sending a link — which is exactly why
 * it was farmable. Nothing is owed until the invited person does something, and
 * the screen says so rather than burying it.
 */
export function ReferralPanel({
  link,
  stats,
}: {
  link: string | null;
  stats: ReferralStats;
}) {
  const t = useTranslations("referrals");
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access needs a secure context and can be denied outright.
      // Selecting the text leaves the user a working manual copy instead of a
      // button that appears to do nothing.
      inputRef.current?.select();
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="referral-panel">
      <section className="premium-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">{t("linkTitle")}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("linkBody")}</p>

        {link ? (
          <div className="mt-3 flex gap-2">
            <input
              ref={inputRef}
              readOnly
              value={link}
              aria-label={t("linkTitle")}
              data-testid="referral-link"
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            />
            <button
              type="button"
              onClick={copyLink}
              data-testid="referral-copy"
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link"
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground" data-testid="referral-link-unavailable">
            {t("linkUnavailable")}
          </p>
        )}
      </section>

      {/* Two numbers, and the gap between them is the honest part. */}
      <section className="premium-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">{t("statsTitle")}</h2>
        <div className="mt-3 flex gap-3">
          <div className="flex-1 rounded-xl border border-border/60 bg-muted/25 p-3">
            <p className="text-2xl font-semibold" data-testid="referral-total">
              {stats.total}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("statJoined")}</p>
          </div>
          <div className="flex-1 rounded-xl border border-border/60 bg-muted/25 p-3">
            <p className="text-2xl font-semibold" data-testid="referral-converted">
              {stats.converted}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("statConverted")}</p>
          </div>
        </div>
        {stats.total === 0 && (
          <p className="mt-3 text-xs text-muted-foreground" data-testid="referral-empty">
            {t("empty")}
          </p>
        )}
      </section>

      <section className="premium-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">{t("howTitle")}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("howBody")}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("howNotice")}</p>
      </section>
    </div>
  );
}
