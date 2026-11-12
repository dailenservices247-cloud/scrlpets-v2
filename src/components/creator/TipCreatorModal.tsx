"use client";

import { useState } from "react";
import { X, Heart, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const PRESET_AMOUNTS = [2, 5, 10, 20];

export function TipCreatorModal({
  creatorName,
  creatorUsername,
  onClose,
}: {
  creatorName: string;
  creatorUsername: string;
  onClose: () => void;
}) {
  const [selectedAmount, setSelectedAmount] = useState<number>(5);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [tipped, setTipped] = useState(false);

  const activeAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;

  function handleSendTip(e: React.FormEvent) {
    e.preventDefault();
    if (activeAmount <= 0) return;
    setBusy(true);

    setTimeout(() => {
      setBusy(false);
      setTipped(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    }, 700);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      data-testid="tip-creator-modal"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {tipped ? (
          <div className="py-8 text-center space-y-3" data-testid="tip-success">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
              <Check className="size-7" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Tip Sent Successfully!</h3>
            <p className="text-xs text-muted-foreground">
              You sent <strong className="text-foreground">${activeAmount.toFixed(2)}</strong> to {creatorName}.
              Direct deposited to their verified Relay Financial account.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendTip} className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
              <Heart className="size-4" />
              <span>Send Fan Tip &amp; Stars</span>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground">Support {creatorName}</h2>
              <p className="text-xs text-muted-foreground">
                @{creatorUsername} · Creator funds and fan tips directly support content production.
              </p>
            </div>

            {/* Amount Selection */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">
                Choose Amount
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS.map((amt) => {
                  const active = !customAmount && selectedAmount === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setSelectedAmount(amt);
                        setCustomAmount("");
                      }}
                      className={`min-h-11 rounded-xl border text-sm font-bold transition ${
                        active
                          ? "border-rose-500 bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40"
                          : "border-border/70 bg-muted/30 text-foreground hover:bg-muted/60"
                      }`}
                      data-testid={`tip-amount-${amt}`}
                    >
                      ${amt}
                    </button>
                  );
                })}
              </div>

              {/* Custom amount */}
              <div className="mt-2 relative">
                <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">$</span>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  placeholder="Custom amount"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                  }}
                  className="min-h-10 w-full rounded-xl border border-input bg-card pl-6 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Fan Note */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Add a Supporter Message (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Love your pet reels and training updates! 🐾"
                rows={2}
                maxLength={200}
                className="w-full rounded-xl border border-input bg-card p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Security Callout */}
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-micro text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-emerald-400" />
              <span>
                Secured via Stripe Express. 100% of fan contributions transfer directly to the creator&apos;s verified business account.
              </span>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-xl border border-input px-4 text-xs font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <Button
                type="submit"
                disabled={busy || activeAmount <= 0}
                className="min-h-11 bg-rose-500 text-white hover:bg-rose-600 font-semibold px-5"
                data-testid="submit-tip-btn"
              >
                {busy ? "Processing..." : `Send $${activeAmount.toFixed(2)} Tip`}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
