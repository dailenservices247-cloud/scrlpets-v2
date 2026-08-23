"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { pauseSubscription, resumeSubscription } from "@/lib/subscriptions/actions";
import type { Subscription, SubscriptionTier } from "@/lib/subscriptions/queries";

/**
 * Pausing a plan you are paying for.
 *
 * The allowance and the blocking conditions are stated BEFORE the button, not
 * discovered by pressing it. `pause_subscription` refuses seven different ways,
 * and the two most likely — "this plan does not pause" and "you have an order
 * in flight" — send a member in opposite directions. A generic failure here is
 * a support ticket.
 */
export function PausePanel({
  subscription,
  tier,
}: {
  subscription: Subscription;
  tier: SubscriptionTier | null;
}) {
  const t = useTranslations("subscriptions");
  const router = useRouter();
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paused = subscription.pausedAt !== null;
  const allowed = tier?.pauseMonthsAllowed ?? 0;
  const countAllowed = tier?.pauseCountAllowed ?? 0;
  const planPauses = countAllowed > 0 && allowed > 0;

  function explain(raw: string): string {
    const map: Record<string, string> = {
      months_must_be_positive: "pauseErrorMonths",
      no_active_subscription: "pauseErrorNoSubscription",
      already_paused: "pauseErrorAlreadyPaused",
      plan_does_not_allow_pausing: "pauseErrorPlanDisallows",
      no_pauses_remaining: "pauseErrorNoneRemaining",
      pause_allowance_exceeded: "pauseErrorAllowanceExceeded",
      too_soon_to_pause: "pauseErrorTooSoon",
      order_in_flight: "pauseErrorOrderInFlight",
      not_paused: "pauseErrorNotPaused",
    };
    const hit = Object.keys(map).find((k) => raw.includes(k));
    return t(hit ? map[hit] : "pauseErrorGeneric");
  }

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (!result.ok) {
      setError(explain(result.error ?? ""));
      return;
    }
    router.refresh();
  }

  return (
    <div className="premium-panel flex flex-col gap-2 rounded-2xl p-4" data-testid="pause-panel">
      <p className="eyebrow">{t("pauseHeading")}</p>

      {!planPauses ? (
        <p className="text-xs text-muted-foreground" data-testid="pause-not-on-plan">
          {t("pauseNotOnThisPlan")}
        </p>
      ) : paused ? (
        <>
          <p className="text-sm" data-testid="pause-paused-notice">
            {t("pausedNotice")}
          </p>
          <Button
            type="button"
            disabled={busy}
            data-testid="pause-resume"
            onClick={() => run(resumeSubscription)}
          >
            {busy ? t("resuming") : t("resumeSubmit")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t("pauseHelp")}</p>
          {/* Said before the button, so "no pauses remaining" is never a surprise. */}
          <p className="text-xs text-muted-foreground" data-testid="pause-allowance">
            {t("pauseAllowance", {
              used: subscription.pausedMonthsUsed,
              allowed,
              count: subscription.pausesUsed,
              countAllowed,
            })}
          </p>
          <label className="text-xs text-muted-foreground" htmlFor="pause-months">
            {t("pauseMonths")}
          </label>
          <input
            id="pause-months"
            type="number"
            min={1}
            max={Math.max(1, allowed - subscription.pausedMonthsUsed)}
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            data-testid="pause-months"
          />
          <Button
            type="button"
            disabled={busy || subscription.pausesUsed >= countAllowed}
            data-testid="pause-submit"
            onClick={() => run(() => pauseSubscription(months))}
          >
            {busy ? t("pausing") : t("pauseSubmit")}
          </Button>
        </>
      )}

      {error && (
        <p className="text-sm text-destructive" data-testid="pause-error">
          {error}
        </p>
      )}
    </div>
  );
}
