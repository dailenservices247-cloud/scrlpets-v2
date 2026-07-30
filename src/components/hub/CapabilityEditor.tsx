"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { updateBrandCapabilities } from "@/lib/hub/actions";
import { CAPABILITY_OPTIONS, type BrandCapability } from "@/lib/hub/capabilities";

// R2: manager-only checkbox list so an LLC/operator brand (no default
// capabilities) or any brand can turn modules on for itself.
export function CapabilityEditor({
  brandId,
  capabilities,
}: {
  brandId: string;
  capabilities: BrandCapability[];
}) {
  const t = useTranslations("hub");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<BrandCapability>>(new Set(capabilities));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  function toggle(value: BrandCapability) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(false);
    const result = await updateBrandCapabilities(brandId, [...selected]);
    setBusy(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <div className="premium-panel rounded-2xl p-4" data-testid="capability-editor">
      <p className="eyebrow">{t("capabilityEyebrow")}</p>
      <h2 className="mt-1 text-lg font-semibold">{t("capabilityTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("capabilityBody")}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {CAPABILITY_OPTIONS.map((option) => (
          <li key={option.value}>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border/70 bg-muted/25 px-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={selected.has(option.value)}
                onChange={() => toggle(option.value)}
                data-testid={`capability-${option.value}`}
                className="size-4"
              />
              {t(`capability.${option.value}`)}
            </label>
          </li>
        ))}
      </ul>
      <Button className="mt-4" disabled={busy} data-testid="capability-save" onClick={save}>
        {busy ? t("capabilitySaving") : t("capabilitySave")}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert" data-testid="capability-error">
          {t("capabilityError")}
        </p>
      )}
    </div>
  );
}
