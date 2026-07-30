"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { reviewRedemption } from "@/lib/rewards/actions";
import type { RedemptionReviewRow } from "@/lib/admin/queries";

/**
 * E: goods redemptions waiting on a human. Rejecting refunds the points inside
 * the definer, so the member is never charged for something that was not sent —
 * the button says so rather than leaving the admin to guess.
 */
export function RedemptionQueue({ redemptions }: { redemptions: RedemptionReviewRow[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function decide(id: string, decision: "approved" | "rejected" | "fulfilled") {
    setBusy(id);
    const result = await reviewRedemption(id, decision, notes[id]);
    setBusy(null);
    if (result.ok) router.refresh();
  }

  if (redemptions.length === 0) {
    return (
      <p
        className="py-6 text-center text-sm text-muted-foreground"
        data-testid="redemption-queue-empty"
      >
        {t("redemptionsEmpty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="redemption-queue">
      {redemptions.map((r) => (
        <li key={r.id} className="premium-panel rounded-2xl p-4" data-testid="admin-redemption-row">
          <p className="text-sm font-semibold">{r.rewardTitle ?? r.rewardKey}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {r.username ?? "—"} · {t("redemptionPoints", { points: r.pointsSpent })} ·{" "}
            {t(`redemptionStatus.${r.status}`)}
          </p>
          {r.adminNotes && <p className="mt-1 text-xs text-muted-foreground">{r.adminNotes}</p>}
          <input
            value={notes[r.id] ?? ""}
            onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
            placeholder={t("notesPlaceholder")}
            aria-label={t("notesPlaceholder")}
            data-testid={`redemption-notes-${r.id}`}
            className="mt-3 min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {/* Approve only makes sense while it is still `requested`; once
                approved, the remaining move is marking it actually sent. */}
            {r.status === "requested" && (
              <button
                type="button"
                onClick={() => decide(r.id, "approved")}
                disabled={busy === r.id}
                data-testid={`redemption-approve-${r.id}`}
                className="min-h-11 flex-1 rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
              >
                {t("approve")}
              </button>
            )}
            <button
              type="button"
              onClick={() => decide(r.id, "fulfilled")}
              disabled={busy === r.id}
              data-testid={`redemption-fulfil-${r.id}`}
              className="min-h-11 flex-1 rounded-xl border border-input px-4 text-sm font-medium disabled:opacity-50"
            >
              {t("markFulfilled")}
            </button>
            <button
              type="button"
              onClick={() => decide(r.id, "rejected")}
              disabled={busy === r.id}
              data-testid={`redemption-reject-${r.id}`}
              className="min-h-11 flex-1 rounded-xl border border-destructive/50 px-4 text-sm font-medium text-destructive disabled:opacity-50"
            >
              {t("rejectAndRefund")}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
