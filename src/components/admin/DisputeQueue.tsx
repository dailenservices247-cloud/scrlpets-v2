"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { settleOrder, type SettlementBranch } from "@/lib/orders/actions";
import type { DisputeRow } from "@/lib/admin/queries";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : null);

/**
 * The adjudicator's case file and verdict, in one place.
 *
 * The branch buttons matter more than they look: the split is derived in the
 * database FROM the branch, never typed here, so the same failure mode cannot
 * settle two different ways on two different days. That is the whole claim a
 * published policy makes, and a free-text amount field would quietly undo it.
 *
 * §4 offers only the remedy the SELLER published. Letting an adjudicator pick
 * any of the three would be the platform rewriting a promise after the fact —
 * the exact thing legacy did when it assigned guarantee terms by subscription
 * tier.
 */
export function DisputeQueue({ disputes }: { disputes: DisputeRow[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [vetCosts, setVetCosts] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});

  async function decide(row: DisputeRow, branch: SettlementBranch) {
    setBusy(row.orderId);
    setErr((e) => ({ ...e, [row.orderId]: "" }));
    const cents =
      branch === "guarantee_vet_costs"
        ? Math.round(Number(vetCosts[row.orderId] ?? "0") * 100)
        : undefined;
    const result = await settleOrder(row.orderId, branch, notes[row.orderId], cents);
    setBusy(null);
    if (result.ok) {
      router.refresh();
      return;
    }
    // `animal_not_returned` is the refusal that protects the seller from losing
    // both the animal and the money. It must read as an instruction, not a bug.
    setErr((e) => ({
      ...e,
      [row.orderId]:
        result.error === "animal_not_returned"
          ? t("disputeNeedsReturn")
          : (result.error ?? "error"),
    }));
  }

  if (disputes.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground" data-testid="dispute-queue-empty">
        {t("disputesEmpty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="dispute-queue">
      {disputes.map((d) => {
        const evidence: [string, string | null][] = [
          [t("evidenceHandover"), when(d.handoverAt)],
          [t("evidencePickup"), when(d.pickedUpAt)],
          [t("evidenceDelivered"), when(d.deliveredAt)],
          [
            t("evidenceTracking"),
            d.trackingNumber ? `${d.carrier ?? "?"} ${d.trackingNumber}` : null,
          ],
          [t("evidenceReturned"), when(d.animalReturnedAt)],
        ];
        return (
          <li key={d.orderId} className="premium-panel rounded-2xl p-4" data-testid="admin-dispute-row">
            <p className="text-sm font-semibold">{d.titleSnapshot ?? d.orderId}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {d.buyerUsername ?? "—"} → {d.sellerUsername ?? "—"} · {money(d.amountCents)}
              {d.depositCents > 0 && ` · ${t("evidenceDeposit", { amount: money(d.depositCents) })}`}
              {d.transportCents > 0 &&
                ` · ${t("evidenceTransport", { amount: money(d.transportCents) })}`}
              {` · ${t(`fulfilment.${d.fulfilment}`)}`}
            </p>

            {d.disputeReason && (
              <p className="mt-2 rounded bg-muted/40 p-2 text-sm" data-testid="dispute-reason">
                {d.disputeReason}
              </p>
            )}

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span data-testid="dispute-anchor">
                {d.anchorVerified ? t("evidenceAnchorYes") : t("evidenceAnchorNo")}
              </span>
              {evidence.map(([label, value]) =>
                value ? (
                  <span key={label}>
                    {label}: {value}
                  </span>
                ) : null,
              )}
            </div>

            <p className="mt-2 text-xs" data-testid="dispute-guarantee">
              {d.guaranteeHeadline ?? t("evidenceNoGuarantee")}
            </p>

            <input
              value={notes[d.orderId] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [d.orderId]: e.target.value }))}
              placeholder={t("notesPlaceholder")}
              aria-label={t("notesPlaceholder")}
              data-testid={`dispute-notes-${d.orderId}`}
              className="mt-3 min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            />

            <div className="mt-2 flex flex-wrap gap-2">
              <Branch row={d} branch="refusal_no_cause" label={t("branchRefusal")} onPick={decide} busy={busy} />
              <Branch row={d} branch="no_show_buyer" label={t("branchNoShowBuyer")} onPick={decide} busy={busy} />
              <Branch row={d} branch="no_show_seller" label={t("branchNoShowSeller")} onPick={decide} busy={busy} />
              <Branch row={d} branch="wrong_animal" label={t("branchWrongAnimal")} onPick={decide} busy={busy} />
              <Branch row={d} branch="guarantee_not_covered" label={t("branchNotCovered")} onPick={decide} busy={busy} />
              <Branch row={d} branch="guarantee_ambiguous" label={t("branchAmbiguous")} onPick={decide} busy={busy} />
            </div>

            {/* Only the remedy this seller actually published. */}
            {d.guaranteeBranch && (
              <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="dispute-published-remedy">
                {d.guaranteeBranch === "guarantee_vet_costs" && (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder={t("vetCostsPlaceholder")}
                    aria-label={t("vetCostsPlaceholder")}
                    value={vetCosts[d.orderId] ?? ""}
                    onChange={(e) => setVetCosts((v) => ({ ...v, [d.orderId]: e.target.value }))}
                    data-testid={`dispute-vet-costs-${d.orderId}`}
                    className="min-h-11 w-32 rounded-xl border border-input bg-transparent px-3 text-sm"
                  />
                )}
                <Branch
                  row={d}
                  branch={d.guaranteeBranch as SettlementBranch}
                  label={t("branchUphold")}
                  onPick={decide}
                  busy={busy}
                />
              </div>
            )}

            {err[d.orderId] && (
              <p className="mt-2 text-sm text-destructive" data-testid={`dispute-error-${d.orderId}`}>
                {err[d.orderId]}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Branch({
  row,
  branch,
  label,
  onPick,
  busy,
}: {
  row: DisputeRow;
  branch: SettlementBranch;
  label: string;
  onPick: (row: DisputeRow, branch: SettlementBranch) => void;
  busy: string | null;
}) {
  return (
    <button
      type="button"
      disabled={busy === row.orderId}
      onClick={() => onPick(row, branch)}
      data-testid={`dispute-branch-${branch}`}
      className="min-h-11 rounded-xl border border-input px-3 text-sm disabled:opacity-50"
    >
      {label}
    </button>
  );
}
