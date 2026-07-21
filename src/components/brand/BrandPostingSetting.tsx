"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { setBrandPostingRestriction } from "@/lib/brands/actions";
import { canManageBrandContent } from "@/lib/brands/types";
import type { BrandRole } from "@/lib/brands/types";

// matrix row 3 setting. Only admins/owners see or change it; enforcement is the
// RLS insert policy + the manager-gated RPC. This UI mirrors that state.
export function BrandPostingSetting({
  brandId,
  viewerRole,
  initialRestrict,
}: {
  brandId: string;
  viewerRole: BrandRole;
  initialRestrict: boolean;
}) {
  const t = useTranslations("brandAccess");
  const [restrict, setRestrict] = useState(initialRestrict);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (!canManageBrandContent(viewerRole)) return null;

  async function toggle() {
    setBusy(true);
    setError(false);
    const next = !restrict;
    const formData = new FormData();
    formData.set("brandId", brandId);
    formData.set("restrict", String(next));
    const result = await setBrandPostingRestriction(formData);
    setBusy(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setRestrict(next);
  }

  return (
    <section
      className="premium-panel rounded-2xl p-4"
      data-testid="brand-posting-setting"
    >
      <h2 className="text-lg font-semibold">{t("restrictTitle")}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {t("restrictBody")}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium" data-testid="brand-posting-state">
          {restrict ? t("restrictOn") : t("restrictOff")}
        </span>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={restrict}
          data-testid="brand-posting-toggle"
          className="min-h-11 rounded-xl border border-input bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          {busy
            ? t("restrictSaving")
            : restrict
              ? t("restrictAllow")
              : t("restrictEnable")}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {t("restrictError")}
        </p>
      )}
    </section>
  );
}
