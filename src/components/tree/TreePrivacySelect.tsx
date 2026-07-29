"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { setTreePrivacy } from "@/lib/tree/actions";
import type { TreePrivacy } from "@/lib/tree/queries";

const OPTIONS: TreePrivacy[] = ["public", "buyers", "private"];

// Immediate on-change apply, same pattern as BrandPostingSetting — no separate
// submit button for a single-field setting.
export function TreePrivacySelect({ initialValue }: { initialValue: TreePrivacy }) {
  const t = useTranslations("tree");
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function change(next: TreePrivacy) {
    const previous = value;
    setValue(next);
    setBusy(true);
    setError(false);
    const formData = new FormData();
    formData.set("treePrivacy", next);
    const result = await setTreePrivacy(formData);
    setBusy(false);
    if (!result.ok) {
      setValue(previous);
      setError(true);
    }
  }

  return (
    <div>
      <label className="flex flex-col gap-1 text-sm" htmlFor="tree-privacy-select">
        <span className="text-xs text-muted-foreground">{t("privacyLabel")}</span>
        <select
          id="tree-privacy-select"
          value={value}
          disabled={busy}
          onChange={(event) => change(event.target.value as TreePrivacy)}
          className="min-h-11 rounded-lg border border-input bg-background p-2 text-sm"
          data-testid="tree-privacy-select"
        >
          {OPTIONS.map((option) => (
            <option key={option} value={option}>
              {t(`privacy.${option}`)}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {t("privacyError")}
        </p>
      )}
    </div>
  );
}
