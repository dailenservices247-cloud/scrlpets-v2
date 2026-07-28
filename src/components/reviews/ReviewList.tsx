import { getTranslations } from "next-intl/server";
import { summarize, type Review } from "@/lib/reviews/queries";

function Stars({ value }: { value: number }) {
  return (
    <span aria-hidden className="text-brand-link">
      {"★".repeat(value)}
      <span className="text-muted-foreground">{"★".repeat(5 - value)}</span>
    </span>
  );
}

/**
 * The trust surface that replaced the deleted score. Every number here is an
 * average of real reviews from confirmed handovers — nothing weighted,
 * nothing purchasable, and the count is always shown so a single 5-star
 * review cannot masquerade as a reputation.
 */
export async function ReviewList({ reviews }: { reviews: Review[] }) {
  const t = await getTranslations("reviews");
  const summary = summarize(reviews);

  if (summary.count === 0) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-4" data-testid="reviews">
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("heading")}</h2>
          <p className="mt-2 text-sm text-muted-foreground" data-testid="reviews-empty">
            {t("noneYet")}
          </p>
        </div>
      </section>
    );
  }

  const breakdown = [
    { key: "accuracy", value: summary.accuracy },
    { key: "communication", value: summary.communication },
    { key: "health", value: summary.health },
  ].filter((b) => b.value !== null);

  return (
    <section className="mx-auto max-w-2xl px-4 py-4" data-testid="reviews">
      <div className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("heading")}</h2>
        <p className="mt-2 text-2xl font-semibold" data-testid="reviews-average">
          {summary.average}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {t("fromCount", { count: summary.count })}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t("verifiedNotice")}</p>

        {breakdown.length > 0 && (
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {breakdown.map((b) => (
              <div key={b.key} className="rounded-xl border border-border/70 bg-muted/30 p-2">
                <dt className="text-xs text-muted-foreground">{t(b.key)}</dt>
                <dd className="text-lg font-semibold" data-testid={`reviews-${b.key}`}>
                  {b.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <ul className="mt-4 flex flex-col gap-4">
          {reviews.map((r) => (
            <li key={r.id} className="border-t pt-3 first:border-t-0 first:pt-0" data-testid="review-row">
              <div className="flex items-baseline justify-between gap-2">
                <Stars value={r.rating} />
                <span className="text-xs text-muted-foreground">@{r.reviewerUsername ?? "—"}</span>
              </div>
              {r.title && <p className="mt-1 text-sm font-semibold">{r.title}</p>}
              {r.body && <p className="mt-1 text-sm leading-relaxed">{r.body}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
