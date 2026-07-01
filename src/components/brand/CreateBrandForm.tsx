"use client";
import { useState } from "react";
import { createBrand } from "@/lib/brands/actions";
import { BRAND_TYPE_OPTIONS } from "@/lib/brands/types";
import { Button } from "@/components/ui/button";

export function CreateBrandForm() {
  const [name, setName] = useState("");
  const [brandType, setBrandType] = useState(BRAND_TYPE_OPTIONS[0].value);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("brandType", brandType);
    // On success createBrand redirects (throws NEXT_REDIRECT); it only returns on failure.
    const res = await createBrand(fd);
    setBusy(false);
    setErr(res.error === "required" ? "Name is required." : "Could not create brand.");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pt-2" data-testid="create-brand-form">
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted-foreground">Brand name</span>
        <input
          className="w-full rounded border border-input bg-transparent p-2"
          placeholder="e.g. Blue River Kennels"
          aria-label="Brand name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="brand-name"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted-foreground">Brand type</span>
        <select
          className="w-full rounded border border-input bg-transparent p-2"
          aria-label="Brand type"
          value={brandType}
          onChange={(e) => setBrandType(e.target.value as typeof brandType)}
          data-testid="brand-type"
        >
          {BRAND_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={busy} data-testid="brand-create-submit">
        Create brand
      </Button>
    </form>
  );
}
