"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recommendProduct } from "@/lib/marketplace/actions";

export function RecommendButton({
  listingId,
  brands = [],
  creatures = [],
}: {
  listingId: string;
  brands?: { id: string; name: string }[];
  creatures?: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedCreature, setSelectedCreature] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRecommend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await recommendProduct(
      listingId,
      selectedBrand || null,
      selectedCreature || null,
      note || null,
    );
    setBusy(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 1500);
    } else {
      setError(res.error ?? "Failed to save recommendation");
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5"
        data-testid="recommend-product-btn"
      >
        <Sparkles className="size-3.5 text-brand-link" aria-hidden />
        <span>Recommend</span>
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recommend to Your Pack
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      {success ? (
        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-secondary-foreground">
          <Check className="size-4" aria-hidden />
          <span>Added to your recommended products!</span>
        </div>
      ) : (
        <form onSubmit={handleRecommend} className="mt-3 flex flex-col gap-2.5">
          {brands.length > 0 && (
            <div>
              <label className="mb-1 block text-micro text-muted-foreground">Attach to Brand / Kennel</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full rounded-xl border border-input bg-background p-2 text-xs"
              >
                <option value="">Personal Profile Only</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {creatures.length > 0 && (
            <div>
              <label className="mb-1 block text-micro text-muted-foreground">Attach to Animal Kit (Optional)</label>
              <select
                value={selectedCreature}
                onChange={(e) => setSelectedCreature(e.target.value)}
                className="w-full rounded-xl border border-input bg-background p-2 text-xs"
              >
                <option value="">General Recommendation</option>
                {creatures.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-micro text-muted-foreground">Personal Endorsement Note</label>
            <input
              type="text"
              placeholder="e.g. Essential puppy training treats we use every day"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-input bg-background p-2 text-xs"
            />
          </div>

          {error && <p className="text-micro text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={busy}
            size="sm"
            className="mt-1 flex items-center justify-center gap-1.5"
          >
            <Sparkles className="size-3.5" aria-hidden />
            <span>{busy ? "Saving..." : "Save Recommendation"}</span>
          </Button>
        </form>
      )}
    </div>
  );
}
