"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MediaInput } from "@/components/compose/MediaInput";
import { SERVICE_CATEGORIES } from "@/lib/services/categories";
import { createProviderService } from "@/lib/services/actions";
import type { ComposeAttribution } from "./ComposerTabs";

export function ServiceComposeForm({
  userId,
  attribution,
  disabled,
}: {
  userId: string;
  attribution: ComposeAttribution;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(SERVICE_CATEGORIES[0]);
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("category", category);
    fd.set("price", price.trim());
    fd.set("area", area.trim());
    fd.set("description", description.trim());
    fd.set("contactNote", contactNote.trim());
    if (mediaUrl) fd.set("mediaUrl", mediaUrl);
    if (attribution.brandId) fd.set("brandId", attribution.brandId);

    const res = await createProviderService(fd);
    setBusy(false);

    if (res.ok) {
      router.push("/market?tab=services");
    } else {
      setErr(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" data-testid="service-compose-form">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Service Name</label>
        <input
          required
          placeholder="e.g. Professional Boarding, Puppy Training, Grooming"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Rate / Price ($ USD)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 75.00 (optional)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Coverage Area / Region</label>
        <input
          placeholder="e.g. Greater Columbus &amp; Midwest or Nationwide (Transporters)"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Description &amp; Details</label>
        <textarea
          rows={3}
          placeholder="Explain what is included, schedule details, booking policies..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-input bg-transparent p-3 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Booking / Contact Instructions</label>
        <input
          placeholder="e.g. Inquire via chat or book 48h in advance"
          value={contactNote}
          onChange={(e) => setContactNote(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
        />
      </div>

      <MediaInput userId={userId} onUploaded={setMediaUrl} />

      {err && <p className="text-xs text-destructive">{err}</p>}

      <Button type="submit" disabled={disabled || busy} className="min-h-11 font-semibold">
        {busy ? "Publishing..." : "Publish Service to Marketplace"}
      </Button>
    </form>
  );
}
