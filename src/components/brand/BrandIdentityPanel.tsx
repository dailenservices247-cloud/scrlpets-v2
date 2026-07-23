"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { setBrandIdentity } from "@/lib/brands/actions";
import { uploadPhoto } from "@/lib/media/upload";
import { canManageBrandContent, type BrandRole } from "@/lib/brands/types";

// F3 / punch list A12: banner + avatar upload for managers.
export function BrandIdentityPanel({
  brandId,
  viewerId,
  viewerRole,
  bannerUrl,
  avatarUrl,
}: {
  brandId: string;
  viewerId: string;
  viewerRole: BrandRole;
  bannerUrl: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"banner" | "avatar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!canManageBrandContent(viewerRole)) return null;

  async function upload(kind: "banner" | "avatar", file: File | null) {
    if (!file) return;
    setBusy(kind);
    setError(null);
    const result = await uploadPhoto(file, viewerId);
    if ("error" in result) {
      setBusy(null);
      setError(result.error === "size" ? "Photo must be under 5MB." : "Upload failed.");
      return;
    }
    const form = new FormData();
    form.set("brandId", brandId);
    form.set(kind === "banner" ? "bannerUrl" : "avatarUrl", result.url);
    const saved = await setBrandIdentity(form);
    setBusy(null);
    if (!saved.ok) {
      setError("Could not save. Try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="premium-panel rounded-2xl p-4" data-testid="brand-identity-panel">
      <p className="eyebrow mb-2">Brand identity</p>
      <div className="overflow-hidden rounded-xl border border-border/70">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="h-24 w-full object-cover" data-testid="brand-banner-preview" />
        ) : (
          <div className="grid h-24 w-full place-items-center bg-muted/40 text-xs text-muted-foreground">
            No banner yet
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-accent/35 bg-accent/15 text-accent">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            <Building2 className="size-6" aria-hidden />
          )}
        </span>
        <div className="grid flex-1 gap-2 text-sm">
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">Banner</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy !== null}
              onChange={(e) => upload("banner", e.target.files?.[0] ?? null)}
              data-testid="brand-banner-input"
              className="w-full text-xs"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">Avatar</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy !== null}
              onChange={(e) => upload("avatar", e.target.files?.[0] ?? null)}
              data-testid="brand-avatar-input"
              className="w-full text-xs"
            />
          </label>
        </div>
      </div>
      {busy && <p className="mt-2 text-xs text-muted-foreground">Uploading…</p>}
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
