"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { submitReview } from "@/lib/reviews/actions";

const SCORES = [1, 2, 3, 4, 5] as const;

function ScoreRow({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
  testId: string;
}) {
  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-2">
      <legend className="sr-only">{label}</legend>
      <span className="text-sm">{label}</span>
      <div className="flex gap-1">
        {SCORES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            aria-label={`${label}: ${n}`}
            data-testid={`${testId}-${n}`}
            className={
              value === n
                ? "size-11 rounded-lg border border-primary/60 bg-primary/15 text-sm font-semibold text-brand-link"
                : "size-11 rounded-lg border border-input text-sm text-muted-foreground"
            }
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * A review can only reach this form after both parties confirmed the handover,
 * so there is no "verified purchase" badge to show — every review is one.
 */
export function ReviewForm({
  applicationId,
  subjectId,
  sellerUsername,
  listingTitle,
}: {
  applicationId: string;
  subjectId: string;
  sellerUsername: string | null;
  listingTitle: string | null;
}) {
  const t = useTranslations("reviews");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [communication, setCommunication] = useState<number | null>(null);
  const [health, setHealth] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!rating) {
      setError(t("ratingRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await submitReview(applicationId, subjectId, {
      rating,
      accuracy,
      communication,
      health,
      title,
      body,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "already_reviewed" ? t("alreadyReviewed") : result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`review-open-${applicationId}`}
        className="min-h-11 w-full rounded-xl border border-input px-4 text-sm font-medium"
      >
        {t("leaveReviewFor", { name: sellerUsername ?? "—" })}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-4" data-testid="review-form">
      <p className="eyebrow">{t("reviewing")}</p>
      <p className="mt-1 text-sm font-semibold">{listingTitle ?? t("aHandover")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("verifiedNotice")}</p>

      <div className="mt-4 flex flex-col gap-3">
        <ScoreRow label={t("overall")} value={rating} onChange={setRating} testId="score-overall" />
        <ScoreRow
          label={t("accuracy")}
          value={accuracy}
          onChange={setAccuracy}
          testId="score-accuracy"
        />
        <ScoreRow
          label={t("communication")}
          value={communication}
          onChange={setCommunication}
          testId="score-communication"
        />
        <ScoreRow label={t("health")} value={health} onChange={setHealth} testId="score-health" />
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("titlePlaceholder")}
        aria-label={t("titlePlaceholder")}
        data-testid="review-title"
        className="mt-4 min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("bodyPlaceholder")}
        aria-label={t("bodyPlaceholder")}
        data-testid="review-body"
        className="mt-2 min-h-24 w-full rounded-xl border border-input bg-transparent p-3 text-sm"
      />
      {error && (
        <p className="mt-2 text-xs text-destructive" data-testid="review-error">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          data-testid="review-submit"
          className="min-h-11 flex-1 rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
        >
          {t("publishReview")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 flex-1 rounded-xl border border-input px-4 text-sm font-medium"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
