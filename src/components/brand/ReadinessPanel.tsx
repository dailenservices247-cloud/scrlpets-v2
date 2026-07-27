import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReadinessStep } from "@/lib/breeder-os/queries";

/**
 * R16, deliberately NOT a trust score. Legacy computed a 0-100 "trust score"
 * where uploading an avatar was worth 10 points and a premium subscription was
 * worth 20 — a buyer could not tell a verified seller from a paying one. This
 * is a checklist of things that are actually true, with no number, no ring,
 * and nothing on it that money can complete.
 */
export async function ReadinessPanel({ steps }: { steps: ReadinessStep[] }) {
  const t = await getTranslations("breederOs");
  const remaining = steps.filter((s) => !s.done);

  return (
    <div className="premium-panel rounded-2xl p-4" data-testid="readiness-panel">
      <p className="eyebrow">{t("readinessEyebrow")}</p>
      <h2 className="mt-1 text-lg font-semibold">{t("readinessTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {remaining.length === 0 ? t("readinessComplete") : t("readinessHelp")}
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.key} className="flex items-center gap-3">
            <span
              className={
                step.done
                  ? "grid size-6 shrink-0 place-items-center rounded-full bg-secondary/30 text-secondary-foreground"
                  : "grid size-6 shrink-0 place-items-center rounded-full border border-input text-muted-foreground"
              }
              aria-hidden
            >
              {step.done ? <Check className="size-3.5" /> : <Circle className="size-2.5" />}
            </span>
            <span className="flex-1 text-sm" data-testid={`readiness-${step.key}`}>
              {t(`readinessStep.${step.key}`)}
            </span>
            {step.done ? (
              <span className="text-xs text-muted-foreground">{t("done")}</span>
            ) : (
              <Link href={step.href} className="text-xs text-brand-link underline">
                {t("start")}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
