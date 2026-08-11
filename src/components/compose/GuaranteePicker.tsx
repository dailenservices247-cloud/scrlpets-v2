"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  listGuaranteeTemplates,
  previewGuarantee,
  type GuaranteeTemplate,
  type GuaranteeText,
} from "@/lib/guarantees/queries";

export type GuaranteeChoice = {
  kind: "none" | "template" | "custom";
  templateKey: string | null;
  customTerms: string;
  customRemedy: "vet_costs" | "replacement" | "refund_on_return";
  customDurationDays: string;
};

export const EMPTY_GUARANTEE: GuaranteeChoice = {
  kind: "none",
  templateKey: null,
  customTerms: "",
  customRemedy: "vet_costs",
  customDurationDays: "",
};

/**
 * The seller picks their promise, and sees it as the buyer will.
 *
 * FORCED CHOICE, not a silent default. "No health guarantee" is a radio the
 * seller has to select, because the dispute policy leans on "the listing said so
 * plainly and the buyer accepted that" — and a seller who was never asked can
 * honestly say they did not know they were offering nothing.
 *
 * The preview comes from the database function the listing page renders from, so
 * what is shown here is not a description of the terms, it IS the terms.
 */
export function GuaranteePicker({
  value,
  onChange,
}: {
  value: GuaranteeChoice;
  onChange: (next: GuaranteeChoice) => void;
}) {
  const t = useTranslations("compose");
  const [preview, setPreview] = useState<GuaranteeText | null>(null);
  // Loaded here rather than threaded through the composer's prop chain: it is
  // one list, needed by one control, and three hops of props to deliver it is
  // three places to keep in step.
  const [templates, setTemplates] = useState<GuaranteeTemplate[]>([]);

  useEffect(() => {
    let cancelled = false;
    listGuaranteeTemplates().then((rows) => {
      if (!cancelled) setTemplates(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Custom terms with nothing typed yet would render an empty promise. Derived
  // rather than pushed into state from inside the effect, which cascades renders.
  const hasSomethingToShow = !(value.kind === "custom" && value.customTerms.trim() === "");

  useEffect(() => {
    if (!hasSomethingToShow) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const next = await previewGuarantee({
        kind: value.kind,
        templateKey: value.kind === "template" ? value.templateKey : null,
        customTerms: value.kind === "custom" ? value.customTerms : null,
        customRemedy: value.kind === "custom" ? value.customRemedy : null,
        customDurationDays:
          value.kind === "custom" && value.customDurationDays !== ""
            ? Number(value.customDurationDays)
            : null,
      });
      if (!cancelled) setPreview(next);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, hasSomethingToShow]);

  const set = (patch: Partial<GuaranteeChoice>) => onChange({ ...value, ...patch });

  return (
    <fieldset className="rounded-xl border border-input p-3" data-testid="guarantee-picker">
      <legend className="px-1 text-sm font-medium">{t("guaranteeLegend")}</legend>
      <p className="mb-2 text-xs text-muted-foreground">{t("guaranteeHelp")}</p>

      <div className="flex flex-col gap-2">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="guaranteeKind"
            checked={value.kind === "none"}
            onChange={() => set({ kind: "none", templateKey: null })}
            data-testid="guarantee-kind-none"
            className="mt-1"
          />
          <span>{t("guaranteeNone")}</span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="guaranteeKind"
            checked={value.kind === "template"}
            onChange={() => set({ kind: "template", templateKey: templates[0]?.key ?? null })}
            data-testid="guarantee-kind-template"
            className="mt-1"
          />
          <span>{t("guaranteeTemplate")}</span>
        </label>

        {value.kind === "template" && (
          <select
            className="ml-6 rounded border border-input bg-transparent p-2 text-sm"
            value={value.templateKey ?? ""}
            onChange={(e) => set({ templateKey: e.target.value })}
            data-testid="guarantee-template-select"
            aria-label={t("guaranteeTemplate")}
          >
            {templates.map((tpl) => (
              <option key={tpl.key} value={tpl.key}>
                {tpl.name}
              </option>
            ))}
          </select>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="guaranteeKind"
            checked={value.kind === "custom"}
            onChange={() => set({ kind: "custom", templateKey: null })}
            data-testid="guarantee-kind-custom"
            className="mt-1"
          />
          <span>{t("guaranteeCustom")}</span>
        </label>

        {value.kind === "custom" && (
          <div className="ml-6 flex flex-col gap-2">
            {/* The one place a seller is warned before they write, not after a
                dispute. Ambiguity resolving against them is only fair if they
                had a clear way not to be ambiguous and were told so. */}
            <p className="rounded bg-muted/40 p-2 text-xs text-muted-foreground" data-testid="guarantee-custom-warning">
              {t("guaranteeCustomWarning")}
            </p>
            <textarea
              className="min-h-20 rounded border border-input bg-transparent p-2 text-sm"
              placeholder={t("guaranteeCustomPlaceholder")}
              aria-label={t("guaranteeCustomPlaceholder")}
              value={value.customTerms}
              onChange={(e) => set({ customTerms: e.target.value })}
              data-testid="guarantee-custom-terms"
            />
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">{t("guaranteeRemedyLabel")}</span>
              <select
                className="rounded border border-input bg-transparent p-2 text-sm"
                value={value.customRemedy}
                onChange={(e) =>
                  set({ customRemedy: e.target.value as GuaranteeChoice["customRemedy"] })
                }
                data-testid="guarantee-custom-remedy"
              >
                <option value="vet_costs">{t("remedyVetCosts")}</option>
                <option value="replacement">{t("remedyReplacement")}</option>
                <option value="refund_on_return">{t("remedyRefundOnReturn")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">{t("guaranteeDurationLabel")}</span>
              <input
                type="number"
                min={1}
                className="rounded border border-input bg-transparent p-2 text-sm"
                value={value.customDurationDays}
                onChange={(e) => set({ customDurationDays: e.target.value })}
                data-testid="guarantee-custom-duration"
              />
            </label>
          </div>
        )}
      </div>

      {hasSomethingToShow && preview && (
        <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 p-3" data-testid="guarantee-preview">
          <p className="eyebrow mb-1 text-xs uppercase tracking-wide text-muted-foreground">
            {t("guaranteePreviewLabel")}
          </p>
          <p className="text-sm font-medium" data-testid="guarantee-preview-headline">
            {preview.headline}
          </p>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="guarantee-preview-body">
            {preview.body}
          </p>
          {preview.remedySentence && (
            <p className="mt-1 text-sm" data-testid="guarantee-preview-remedy">
              {preview.remedySentence}
            </p>
          )}
          {preview.durationDays !== null && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("guaranteeDurationDays", { days: preview.durationDays })}
            </p>
          )}
          {preview.conditions.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
              {preview.conditions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </fieldset>
  );
}
