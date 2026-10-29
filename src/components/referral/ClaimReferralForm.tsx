"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Gift, CheckCircle2 } from "lucide-react";
import { claimReferral } from "@/lib/referrals/actions";
import { Button } from "@/components/ui/button";

export function ClaimReferralForm({ claimedCode }: { claimedCode: string | null }) {
  const t = useTranslations("referrals");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (claimedCode) {
    return (
      <section className="premium-panel rounded-2xl p-4 text-xs" data-testid="claimed-referral-banner">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />
          <p className="font-semibold text-foreground">
            Linked to Referrer Code: <span className="font-mono text-brand-link">{claimedCode}</span>
          </p>
        </div>
      </section>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    setSuccess(false);

    const res = await claimReferral(code.trim());
    setBusy(false);
    if (!res.ok) {
      if (res.error === "already_referred") setError(t("claimAlreadyReferred"));
      else if (res.error === "self_referral") setError(t("claimSelf"));
      else if (res.error === "unknown_code") setError(t("claimUnknown"));
      else if (res.error === "already_active") setError(t("claimActive"));
      else setError(res.error);
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <section className="premium-panel rounded-2xl p-4" data-testid="claim-referral-panel">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-full bg-primary/20 text-brand-link">
          <Gift className="size-3.5" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">{t("claimTitle")}</h2>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{t("claimBody")}</p>

      {success ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" aria-hidden />
          <span>{t("claimSuccess")}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2.5 sm:flex-row">
          <input
            type="text"
            required
            placeholder={t("claimPlaceholder")}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="flex-1 rounded-xl border border-input bg-transparent px-3 py-2 text-xs font-mono uppercase tracking-wider"
          />
          <Button type="submit" size="sm" disabled={busy || !code.trim()} data-testid="submit-claim-btn">
            {busy ? "..." : t("claimButton")}
          </Button>
        </form>
      )}

      {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
    </section>
  );
}
