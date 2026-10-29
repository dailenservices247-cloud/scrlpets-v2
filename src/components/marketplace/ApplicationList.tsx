"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { setApplicationStatus } from "@/lib/applications/actions";
import { confirmHandover } from "@/lib/reviews/actions";
import { startConversation } from "@/lib/messaging/actions";
import type { BuyerApplication } from "@/lib/applications/queries";

type FilterTab = "all" | "pending" | "accepted" | "closed";

export function ApplicationList({
  applications,
  viewerId,
}: {
  applications: BuyerApplication[];
  viewerId: string;
}) {
  const t = useTranslations("applications");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  async function confirm(id: string) {
    setBusy(id);
    const result = await confirmHandover(id);
    setBusy(null);
    if (result.ok) router.refresh();
  }

  async function decide(id: string, status: "accepted" | "declined") {
    setBusy(id);
    const result = await setApplicationStatus(id, status);
    setBusy(null);
    if (result.ok) router.refresh();
  }

  async function handleOpenChat(counterpartyId: string) {
    setBusy(`chat-${counterpartyId}`);
    const res = await startConversation(counterpartyId);
    setBusy(null);
    if ("id" in res) {
      router.push(`/messages/${res.id}`);
    }
  }

  const filtered = applications.filter((a) => {
    if (activeTab === "pending") return a.status === "submitted";
    if (activeTab === "accepted") return a.status === "accepted";
    if (activeTab === "closed") return a.status === "declined" || a.status === "withdrawn";
    return true;
  });

  if (applications.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground" data-testid="applications-empty">
        {t("empty")}
      </p>
    );
  }

  const counts = {
    all: applications.length,
    pending: applications.filter((a) => a.status === "submitted").length,
    accepted: applications.filter((a) => a.status === "accepted").length,
    closed: applications.filter((a) => a.status === "declined" || a.status === "withdrawn").length,
  };

  return (
    <div className="space-y-3">
      {/* Inbox filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Application Status">
        {(["all", "pending", "accepted", "closed"] as const).map((tab) => {
          const active = activeTab === tab;
          const labels: Record<FilterTab, string> = {
            all: `All (${counts.all})`,
            pending: `Pending (${counts.pending})`,
            accepted: `Accepted (${counts.accepted})`,
            closed: `Closed (${counts.closed})`,
          };
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`min-h-9 shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-primary bg-primary/15 text-brand-link"
                  : "border-input text-muted-foreground hover:bg-muted"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No applications in this view.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="applications-list">
          {filtered.map((a) => {
            const viewerIsSeller = a.sellerId === viewerId;
            const counterparty = viewerIsSeller ? a.buyerUsername : a.sellerUsername;
            const counterpartyId = viewerIsSeller ? a.buyerId : a.sellerId;

            return (
              <li key={a.id} className="premium-panel rounded-2xl p-4 transition hover:border-primary/30" data-testid="application-row">
                <div className="flex items-center justify-between gap-2">
                  <p className="eyebrow">
                    {a.listingId ? t("kindApplication") : t("kindWaitlist")}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-micro font-medium ${
                      a.status === "accepted"
                        ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : a.status === "submitted"
                          ? "border border-amber-500/40 bg-amber-500/10 text-amber-300"
                          : "border border-border/70 bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {t(`status.${a.status}`)}
                  </span>
                </div>

                <p className="mt-1 text-sm font-semibold text-foreground">
                  {a.listingId && a.listingTitle ? (
                    <Link href={`/listing/${a.listingId}`} className="text-brand-link hover:underline">
                      {a.listingTitle}
                    </Link>
                  ) : (
                    t("generalInterest")
                  )}
                </p>

                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <p>
                    {viewerIsSeller ? t("fromBuyer") : t("toSeller")}{" "}
                    <Link href={`/u/${counterparty}`} className="font-medium text-foreground hover:underline">
                      @{counterparty ?? "—"}
                    </Link>
                  </p>
                  <span className="text-micro">
                    {new Date(a.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                {a.message && (
                  <p className="mt-2 rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs text-foreground/90 leading-relaxed">
                    &ldquo;{a.message}&rdquo;
                  </p>
                )}

                {/* Handover state for accepted applications */}
                {a.status === "accepted" && (
                  <div className="mt-3">
                    {(viewerIsSeller ? a.sellerConfirmedAt : a.buyerConfirmedAt) ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`handover-confirmed-${a.id}`}>
                        <CheckCircle2 className="size-4 text-emerald-400" />
                        <span>
                          {a.buyerConfirmedAt && a.sellerConfirmedAt
                            ? t("handoverComplete")
                            : t("handoverAwaitingOther")}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => confirm(a.id)}
                        disabled={busy === a.id}
                        data-testid={`handover-confirm-${a.id}`}
                        className="min-h-11 w-full rounded-xl border border-primary/50 bg-primary/10 px-4 text-xs font-semibold text-brand-link transition hover:bg-primary/20 disabled:opacity-50"
                      >
                        {t("confirmHandover")}
                      </button>
                    )}
                  </div>
                )}

                {/* Actions row: Accept / Decline for Seller + Direct Message */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
                  {a.status === "submitted" && viewerIsSeller && (
                    <>
                      <button
                        type="button"
                        onClick={() => decide(a.id, "accepted")}
                        disabled={busy === a.id}
                        data-testid={`application-accept-${a.id}`}
                        className="min-h-9 flex-1 rounded-xl bg-secondary/25 px-3 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary/35 disabled:opacity-50"
                      >
                        {t("accept")}
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(a.id, "declined")}
                        disabled={busy === a.id}
                        data-testid={`application-decline-${a.id}`}
                        className="min-h-9 flex-1 rounded-xl border border-destructive/50 px-3 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {t("decline")}
                      </button>
                    </>
                  )}

                  {counterpartyId && (
                    <button
                      type="button"
                      onClick={() => handleOpenChat(counterpartyId)}
                      disabled={busy === `chat-${counterpartyId}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-input px-3 text-xs font-medium text-brand-link transition hover:bg-muted disabled:opacity-50"
                      data-testid={`application-message-${a.id}`}
                    >
                      <MessageCircle className="size-3.5" aria-hidden />
                      Message @{counterparty}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
