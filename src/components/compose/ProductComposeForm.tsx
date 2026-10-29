"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MediaInput } from "@/components/compose/MediaInput";
import { createListing } from "@/lib/compose/actions";
import type { ComposeAttribution } from "./ComposerTabs";

export function ProductComposeForm({
  userId,
  attribution,
  disabled,
}: {
  userId: string;
  attribution: ComposeAttribution;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("supplies");
  const [description, setDescription] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [shippingFee, setShippingFee] = useState("");
  const [sellerSource, setSellerSource] = useState<"distributor" | "merchant">("distributor");
  const [merchantName, setMerchantName] = useState("");
  const [externalSku, setExternalSku] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("price", price.trim());
    fd.set("category", category.trim());
    fd.set("description", description.trim());
    if (stockQuantity) fd.set("stockQuantity", stockQuantity.trim());
    if (shippingFee) fd.set("shippingFee", shippingFee.trim());
    fd.set("sellerSource", sellerSource);
    if (merchantName) fd.set("merchantName", merchantName.trim());
    if (externalSku) fd.set("externalSku", externalSku.trim());
    if (externalUrl) fd.set("externalUrl", externalUrl.trim());
    if (mediaUrl) fd.set("mediaUrl", mediaUrl);
    if (attribution.brandId) fd.set("brandId", attribution.brandId);

    const res = await createListing(fd);
    setBusy(false);

    if (res.ok) {
      router.push("/market?tab=supplies");
    } else {
      setErr(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" data-testid="product-compose-form">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Product / Supply Name</label>
        <input
          required
          placeholder="e.g. Premium High-Protein Dog Kibble, Puppy Crate, Orthopedic Bed"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Price ($ USD)</label>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            placeholder="e.g. 45.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
          <input
            placeholder="e.g. Food, Crates, Grooming, Toys"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Inventory Units (Stock)</label>
          <input
            type="number"
            min="0"
            placeholder="Blank = made to order"
            value={stockQuantity}
            onChange={(e) => setStockQuantity(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Shipping Fee ($ USD)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00 = Free shipping"
            value={shippingFee}
            onChange={(e) => setShippingFee(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-input p-3">
        <label className="eyebrow mb-2 block">Seller Channel</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSellerSource("distributor")}
            className={`rounded-xl border p-2.5 text-left text-xs transition ${
              sellerSource === "distributor"
                ? "border-primary/70 bg-primary/15 font-semibold text-brand-link"
                : "border-border/70 bg-muted/30 text-muted-foreground"
            }`}
          >
            Independent Seller
          </button>
          <button
            type="button"
            onClick={() => setSellerSource("merchant")}
            className={`rounded-xl border p-2.5 text-left text-xs transition ${
              sellerSource === "merchant"
                ? "border-primary/70 bg-primary/15 font-semibold text-brand-link"
                : "border-border/70 bg-muted/30 text-muted-foreground"
            }`}
          >
            Store / Merchant
          </button>
        </div>

        {sellerSource === "merchant" && (
          <div className="grid gap-2 pt-2 sm:grid-cols-2">
            <input
              className="rounded-xl border border-input bg-transparent p-2 text-xs"
              placeholder="Merchant name (e.g. Chewy, Petco, Local Store)"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
            />
            <input
              className="rounded-xl border border-input bg-transparent p-2 text-xs"
              placeholder="SKU / Barcode (optional)"
              value={externalSku}
              onChange={(e) => setExternalSku(e.target.value)}
            />
            <input
              className="rounded-xl border border-input bg-transparent p-2 text-xs sm:col-span-2"
              placeholder="External Catalog / Purchase URL (https://...)"
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
            />
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Description &amp; Specifications</label>
        <textarea
          rows={3}
          placeholder="Ingredients, sizing, materials, brand specs..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-input bg-transparent p-3 text-sm"
        />
      </div>

      <MediaInput userId={userId} onUploaded={setMediaUrl} />

      {err && <p className="text-xs text-destructive">{err}</p>}

      <Button type="submit" disabled={disabled || busy} className="min-h-11 font-semibold">
        {busy ? "Publishing..." : "Publish Product to Shop"}
      </Button>
    </form>
  );
}
