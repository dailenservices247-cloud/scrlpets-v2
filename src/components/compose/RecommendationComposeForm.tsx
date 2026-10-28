"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createListing } from "@/lib/compose/actions";
import { recommendProduct } from "@/lib/marketplace/actions";
import type { ComposeAttribution, SubjectOption } from "./ComposerTabs";

export function RecommendationComposeForm({
  creatures,
  products,
  attribution,
  disabled,
}: {
  userId: string;
  creatures: { id: string; name: string }[];
  products: SubjectOption[];
  attribution: ComposeAttribution;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [targetType, setTargetType] = useState<"catalog" | "custom">("catalog");
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id ?? "");
  const [customTitle, setCustomTitle] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [selectedCreatureId, setSelectedCreatureId] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    let listingId = selectedProductId;

    if (targetType === "custom") {
      const fd = new FormData();
      fd.set("title", customTitle.trim());
      fd.set("price", customPrice.trim() || "0");
      fd.set("category", "recommendation");
      fd.set("sellerSource", "merchant");
      if (merchantName) fd.set("merchantName", merchantName.trim());
      if (customUrl) fd.set("externalUrl", customUrl.trim());
      if (attribution.brandId) fd.set("brandId", attribution.brandId);

      const listingRes = await createListing(fd);
      if (!listingRes.ok) {
        setBusy(false);
        setErr(listingRes.error);
        return;
      }
      listingId = (listingRes as { listingId?: string }).listingId ?? "";
    }

    if (listingId) {
      const recRes = await recommendProduct(
        listingId,
        attribution.brandId,
        selectedCreatureId || null,
        note.trim() || null,
      );

      setBusy(false);
      if (recRes.ok) {
        router.push("/market?tab=supplies&source=recommended");
      } else {
        setErr(recRes.error ?? "Failed to save recommendation");
      }
    } else {
      setBusy(false);
      setErr("Please select or enter a product");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" data-testid="recommendation-compose-form">
      <div>
        <label className="eyebrow mb-2 block">Recommendation Type</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTargetType("catalog")}
            className={`rounded-xl border p-2.5 text-left text-xs transition ${
              targetType === "catalog"
                ? "border-primary/70 bg-primary/15 font-semibold text-brand-link"
                : "border-border/70 bg-muted/30 text-muted-foreground"
            }`}
          >
            From Existing Catalog
          </button>
          <button
            type="button"
            onClick={() => setTargetType("custom")}
            className={`rounded-xl border p-2.5 text-left text-xs transition ${
              targetType === "custom"
                ? "border-primary/70 bg-primary/15 font-semibold text-brand-link"
                : "border-border/70 bg-muted/30 text-muted-foreground"
            }`}
          >
            Custom / External Product
          </button>
        </div>
      </div>

      {targetType === "catalog" ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Select Product</label>
          {products.length > 0 ? (
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              required
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-xl border border-dashed border-input p-3 text-xs text-muted-foreground">
              No catalog products available yet. Switch to &ldquo;Custom / External Product&rdquo; above.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-xl border border-input p-3">
          <div>
            <label className="mb-1 block text-micro text-muted-foreground">Product Title</label>
            <input
              required
              placeholder="e.g. Purina Pro Plan Puppy Food"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="min-h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-micro text-muted-foreground">Price ($ USD approx)</label>
              <input
                type="number"
                step="0.01"
                placeholder="65.00"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="min-h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-micro text-muted-foreground">Merchant / Store Name</label>
              <input
                placeholder="e.g. Chewy, Amazon, Local Vet"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="min-h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-micro text-muted-foreground">Direct Purchase URL (https://...)</label>
            <input
              type="url"
              placeholder="https://chewy.com/..."
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="min-h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            />
          </div>
        </div>
      )}

      {creatures.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Attach to Animal Kit (Optional)</label>
          <select
            value={selectedCreatureId}
            onChange={(e) => setSelectedCreatureId(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
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
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Your Endorsement Note</label>
        <textarea
          rows={3}
          required
          placeholder="Why do you recommend this? (e.g. 'We send every puppy home with this specific harness.')"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-input bg-transparent p-3 text-sm"
        />
      </div>

      {err && <p className="text-xs text-destructive">{err}</p>}

      <Button type="submit" disabled={disabled || busy} className="min-h-11 font-semibold">
        {busy ? "Saving..." : "Add to Recommended Products"}
      </Button>
    </form>
  );
}
