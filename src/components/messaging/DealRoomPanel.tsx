"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSignature, Truck } from "lucide-react";
import { formatPrice } from "@/lib/shop/format";
import { sendDealContract, signDealContract, acceptTransportQuote } from "@/lib/contracts/actions";
import type { DealContract, TransportQuoteItem } from "@/lib/contracts/queries";
import type { ListingInquiryContext } from "@/lib/marketplace/queries";
import { Button } from "@/components/ui/button";

export function DealRoomPanel({
  conversationId,
  viewerId,
  contracts,
  inquiries,
  quotes = [],
}: {
  conversationId: string;
  viewerId: string;
  contracts: DealContract[];
  inquiries: ListingInquiryContext[];
  quotes?: TransportQuoteItem[];
}) {
  const router = useRouter();
  const [showSendModal, setShowSendModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Send form states
  const targetInquiry = inquiries[0];
  const [agreedPrice, setAgreedPrice] = useState(
    targetInquiry ? (targetInquiry.priceCents / 100).toString() : "1000",
  );
  const [depositAmount, setDepositAmount] = useState(
    targetInquiry ? ((targetInquiry.priceCents * 0.2) / 100).toString() : "200",
  );
  const [goHomeDate, setGoHomeDate] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [sellerSig, setSellerSig] = useState("");

  // Sign form states
  const latestContract = contracts[0] ?? null;
  const [buyerSig, setBuyerSig] = useState("");

  if (!targetInquiry && !latestContract) return null;

  const isSeller = latestContract ? latestContract.sellerId === viewerId : true;
  const isBuyer = latestContract ? latestContract.buyerId === viewerId : false;

  async function handleSendContract(e: React.FormEvent) {
    e.preventDefault();
    if (!targetInquiry?.listingId) {
      setError("No active listing found in conversation");
      return;
    }
    setBusy(true);
    setError(null);
    const pCents = Math.round(parseFloat(agreedPrice) * 100);
    const dCents = Math.round(parseFloat(depositAmount) * 100);
    const res = await sendDealContract(
      conversationId,
      targetInquiry.listingId,
      pCents,
      dCents,
      goHomeDate,
      customNotes,
      sellerSig,
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setShowSendModal(false);
    router.refresh();
  }

  async function handleSignContract(e: React.FormEvent) {
    e.preventDefault();
    if (!latestContract) return;
    setBusy(true);
    setError(null);
    const res = await signDealContract(latestContract.id, buyerSig);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setShowSignModal(false);
    if (res.orderId) {
      router.push(`/orders/${res.orderId}`);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="mb-3 rounded-2xl border border-primary/30 bg-primary/5 p-3" data-testid="deal-room-panel">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-primary/20 text-brand-link">
            <FileSignature className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deal Room</p>
            <p className="text-sm font-semibold">
              {latestContract
                ? latestContract.status === "signed"
                  ? "Deal Contract E-Signed"
                  : "Contract Offer Pending"
                : targetInquiry?.title ?? "Animal Sale Inquiry"}
            </p>
          </div>
        </div>

        {latestContract?.status === "signed" && latestContract.orderId ? (
          <Link
            href={`/orders/${latestContract.orderId}`}
            className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
            data-testid="view-deal-order"
          >
            View Order & Escrow →
          </Link>
        ) : latestContract?.status === "sent" ? (
          isBuyer ? (
            <Button
              size="sm"
              onClick={() => setShowSignModal(true)}
              data-testid="open-sign-contract-btn"
            >
              Review & E-Sign
            </Button>
          ) : (
            <span className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
              Awaiting Buyer Signature
            </span>
          )
        ) : (
          isSeller && targetInquiry?.listingId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSendModal(true)}
              data-testid="open-send-contract-btn"
            >
              Draft Contract Offer
            </Button>
          )
        )}
      </div>

      {latestContract && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Agreed Price: <strong className="text-foreground">{formatPrice(latestContract.agreedPriceCents, "USD")}</strong></span>
          <span>Deposit: <strong className="text-foreground">{formatPrice(latestContract.depositCents, "USD")}</strong></span>
          {latestContract.goHomeDate && <span>Go-Home: <strong className="text-foreground">{latestContract.goHomeDate}</strong></span>}
          <span>Guarantee: <strong className="text-foreground">{latestContract.guaranteeHeadlineSnapshot}</strong></span>
        </div>
      )}

      {quotes.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-primary/20 pt-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Truck className="size-3 text-brand-link" aria-hidden />
            Transporter Quotes
          </p>
          {quotes.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/60 p-2.5 text-xs"
            >
              <div>
                <p className="font-semibold text-foreground">
                  @{q.providerUsername ?? "carrier"} &bull; {q.pickupRegion} → {q.deliveryRegion}
                </p>
                <p className="font-mono text-micro text-muted-foreground">
                  {q.quotedCents ? formatPrice(q.quotedCents, "USD") : "Pending quote"} ({q.payoutPolicySnapshot})
                </p>
                {q.notes && <p className="text-micro italic text-muted-foreground">&ldquo;{q.notes}&rdquo;</p>}
              </div>

              <div>
                {q.status === "quoted" && (isBuyer || isSeller) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      await acceptTransportQuote(q.id);
                      setBusy(false);
                      router.refresh();
                    }}
                  >
                    Accept Quote
                  </Button>
                ) : q.status === "accepted" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-2.5" aria-hidden />
                    ACCEPTED
                  </span>
                ) : (
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">{q.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: Draft and Send Contract */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl">
            <h3 className="text-lg font-bold">Draft Deal Contract Offer</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Terms and health guarantees are cryptographically frozen once sent. 30-day locked standing policy applies.
            </p>
            <form onSubmit={handleSendContract} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Agreed Total Price ($ USD)</span>
                <input
                  type="number"
                  required
                  step="1"
                  min="1"
                  className="w-full rounded-xl border border-input bg-transparent p-2 text-sm"
                  value={agreedPrice}
                  onChange={(e) => setAgreedPrice(e.target.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Required Deposit ($ USD)</span>
                <input
                  type="number"
                  required
                  step="1"
                  min="0"
                  className="w-full rounded-xl border border-input bg-transparent p-2 text-sm"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Estimated Go-Home / Transfer Date</span>
                <input
                  type="date"
                  className="w-full rounded-xl border border-input bg-transparent p-2 text-sm"
                  value={goHomeDate}
                  onChange={(e) => setGoHomeDate(e.target.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Custom Notes / Addendum (Optional)</span>
                <textarea
                  className="w-full rounded-xl border border-input bg-transparent p-2 text-sm"
                  rows={2}
                  placeholder="e.g. Includes first vaccination records and starter food bag"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Seller E-Signature (Full Legal Name)</span>
                <input
                  required
                  placeholder="Type your full legal name to sign"
                  className="w-full rounded-xl border border-input bg-transparent p-2 text-sm font-semibold"
                  value={sellerSig}
                  onChange={(e) => setSellerSig(e.target.value)}
                />
              </label>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowSendModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !sellerSig.trim()}>
                  {busy ? "Sending..." : "Send Contract Offer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Review & E-Sign Contract */}
      {showSignModal && latestContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl">
            <h3 className="text-lg font-bold">Review & E-Sign Deal Contract</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Please review the agreed terms, health guarantee, and deposit policies before signing.
            </p>

            <div className="my-3 space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-xs leading-5">
              <p><strong>Agreed Price:</strong> {formatPrice(latestContract.agreedPriceCents, "USD")}</p>
              <p><strong>Deposit Required:</strong> {formatPrice(latestContract.depositCents, "USD")}</p>
              <p><strong>Deposit Policy:</strong> {latestContract.depositPolicySnapshot}</p>
              <p><strong>Health Guarantee:</strong> {latestContract.guaranteeHeadlineSnapshot}</p>
              <p className="text-muted-foreground">{latestContract.guaranteeBodySnapshot}</p>
              {latestContract.goHomeDate && <p><strong>Estimated Go-Home Date:</strong> {latestContract.goHomeDate}</p>}
              <div className="border-t pt-2">
                <p className="font-semibold text-foreground">Terms Snapshot:</p>
                <p className="mt-1 whitespace-pre-wrap font-mono text-micro text-muted-foreground">{latestContract.contractTermsSnapshot}</p>
              </div>
              <p className="border-t pt-2"><strong>Signed by Seller:</strong> {latestContract.sellerSignature} ({new Date(latestContract.sellerSignedAt).toLocaleDateString()})</p>
            </div>

            <form onSubmit={handleSignContract} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Buyer E-Signature (Full Legal Name)</span>
                <input
                  required
                  placeholder="Type your legal name to sign agreement"
                  className="w-full rounded-xl border border-input bg-transparent p-2 text-sm font-semibold"
                  value={buyerSig}
                  onChange={(e) => setBuyerSig(e.target.value)}
                />
              </label>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowSignModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !buyerSig.trim()}>
                  {busy ? "Signing..." : "Sign & Create Order"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
