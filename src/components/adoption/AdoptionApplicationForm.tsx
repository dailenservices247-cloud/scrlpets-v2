"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { submitAdoptionApplication } from "@/lib/adoption/actions";

const LIVING_SITUATIONS = ["house", "apartment", "condo", "farm", "other"] as const;
const EXPERIENCE_LEVELS = ["first_time", "some_experience", "experienced"] as const;

type LivingSituation = (typeof LIVING_SITUATIONS)[number];
type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/**
 * V2-03 screening application. `src/components/marketplace/InquiryForm.tsx`
 * does not exist in this codebase (the free-text equivalent lives at
 * marketplace/ApplyPanel.tsx, outside this lane's granted paths), so this is
 * a new, fixed form — not a form builder — that writes the adoption-specific
 * columns on buyer_applications the generic ApplyPanel never touches.
 */
export function AdoptionApplicationForm({
  sellerId,
  listingId,
  viewerId,
  viewerIsSeller,
  hasOpenApplication,
}: {
  sellerId: string;
  listingId: string;
  viewerId: string | undefined;
  viewerIsSeller: boolean;
  hasOpenApplication: boolean;
}) {
  const t = useTranslations("applications");
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [livingSituation, setLivingSituation] = useState<LivingSituation>("house");
  const [hasYard, setHasYard] = useState(false);
  const [otherPets, setOtherPets] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("first_time");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (viewerIsSeller) return null;

  async function submit() {
    if (!message.trim()) {
      setError("message_required");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await submitAdoptionApplication({
      sellerId,
      listingId,
      message,
      livingSituation,
      hasYard,
      otherPets,
      experienceLevel,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "already_applied" || result.error === "message_required" ? result.error : "generic");
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <section className="premium-panel rounded-2xl p-4" data-testid="adoption-application-form">
      <h2 className="text-sm font-semibold">{t("adoptionApplyTitle")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("adoptionApplyHelp")}</p>

      {!viewerId ? (
        <Link
          href="/login"
          className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          {t("signInToApply")}
        </Link>
      ) : done || hasOpenApplication ? (
        <p className="mt-4 text-sm font-medium" data-testid="application-open">
          {t("applicationOpen")}{" "}
          <Link href="/applications" className="text-brand-link underline">
            {t("viewApplications")}
          </Link>
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("adoptionWhyLabel")}</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-label={t("adoptionWhyLabel")}
              data-testid="adoption-message"
              className="min-h-24 rounded-xl border border-input bg-transparent p-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("livingSituationLabel")}</span>
            <select
              value={livingSituation}
              onChange={(e) => setLivingSituation(e.target.value as LivingSituation)}
              data-testid="adoption-living-situation"
              className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              {LIVING_SITUATIONS.map((v) => (
                <option key={v} value={v}>
                  {t(`livingSituation.${v}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-input px-3 text-sm">
            {t("hasYardLabel")}
            <input
              type="checkbox"
              checked={hasYard}
              onChange={(e) => setHasYard(e.target.checked)}
              data-testid="adoption-has-yard"
              className="size-5 shrink-0 accent-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("otherPetsLabel")}</span>
            <textarea
              value={otherPets}
              onChange={(e) => setOtherPets(e.target.value)}
              aria-label={t("otherPetsLabel")}
              data-testid="adoption-other-pets"
              className="min-h-16 rounded-xl border border-input bg-transparent p-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("experienceLevelLabel")}</span>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
              data-testid="adoption-experience-level"
              className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              {EXPERIENCE_LEVELS.map((v) => (
                <option key={v} value={v}>
                  {t(`experienceLevel.${v}`)}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <p className="text-xs text-destructive" data-testid="adoption-application-error">
              {t(
                error === "already_applied"
                  ? "alreadyApplied"
                  : error === "message_required"
                    ? "adoptionMessageRequired"
                    : "adoptionApplyError",
              )}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            data-testid="adoption-application-submit"
            className="min-h-11 w-full rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
          >
            {busy ? t("adoptionSubmitting") : t("submitApplication")}
          </button>
        </div>
      )}
    </section>
  );
}
