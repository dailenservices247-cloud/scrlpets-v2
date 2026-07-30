import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";

/**
 * Every answer here was checked against the code before it was written, and
 * says what the product does TODAY — not what it will do. Payments off,
 * identity checks not switched on, no health checking, human-reviewed reports.
 * If a behaviour changes, this page changes with it.
 */
/** The day these answers were last checked against the code. Real, not decorative. */
const LAST_UPDATED = "2026-07-30";

const QUESTIONS = [
  "what",
  "account",
  "buy",
  "identity",
  "badge",
  "health",
  "rules",
  "data",
  "reply",
  "email",
] as const;

export const metadata = {
  title: "FAQ",
  description: "Straight answers about what Scrlpets does today.",
};

export default async function FaqPage() {
  const t = await getTranslations("support");

  return (
    <AppPage>
      <header className="px-4 pb-3 pt-6">
        <time className="eyebrow block" dateTime={LAST_UPDATED} data-testid="faq-updated">
          {t("faq.lastUpdated")}
        </time>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("faq.title")}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("faq.intro")}</p>
      </header>

      <div className="flex flex-col gap-6 px-4 pt-3" data-testid="faq-list">
        {QUESTIONS.map((id) => (
          <section key={id} data-testid={`faq-${id}`}>
            <h2 className="text-lg font-semibold">{t(`faq.q.${id}.q`)}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(`faq.q.${id}.a`)}</p>
          </section>
        ))}
      </div>

      <p className="mt-8 px-4 pb-4 text-sm leading-6">
        {t("faq.footer")}{" "}
        <Link href="/support" className="text-brand-link underline">
          {t("faq.footerLink")}
        </Link>{" "}
        ·{" "}
        <Link href="/guidelines" className="text-brand-link underline">
          {t("guidelinesLink")}
        </Link>
      </p>
    </AppPage>
  );
}
