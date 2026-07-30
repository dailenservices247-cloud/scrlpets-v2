import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";

/**
 * House rules. Every rule here maps to something the product or a reviewer can
 * actually do — the age rule is a DB trigger, the enforcement rule is the real
 * report queue. Nothing aspirational: no promise to inspect animals, no
 * promise to police what the product cannot see.
 */
/** The day these rules were last checked against the code. Real, not decorative. */
const LAST_UPDATED = "2026-07-30";

const RULES = [
  "species",
  "honest",
  "tooYoung",
  "welfare",
  "people",
  "spam",
  "ownContent",
  "adults",
  "money",
] as const;

export const metadata = {
  title: "Community guidelines",
  description: "The rules for people and animals on Scrlpets, and how they are enforced.",
};

export default async function GuidelinesPage() {
  const t = await getTranslations("support");

  return (
    <AppPage>
      <header className="px-4 pb-3 pt-6">
        <time className="eyebrow block" dateTime={LAST_UPDATED} data-testid="guidelines-updated">
          {t("guidelines.lastUpdated")}
        </time>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("guidelines.title")}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("guidelines.intro")}</p>
      </header>

      <div className="flex flex-col gap-6 px-4 pt-3" data-testid="guidelines-list">
        {RULES.map((id) => (
          <section key={id} data-testid={`guideline-${id}`}>
            <h2 className="text-lg font-semibold">{t(`guidelines.rule.${id}.title`)}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t(`guidelines.rule.${id}.body`)}
            </p>
          </section>
        ))}
      </div>

      <section className="mt-8 px-4" data-testid="guidelines-enforcement">
        <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
          <h2 className="text-lg font-semibold">{t("guidelines.enforcementTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("guidelines.enforcementBody")}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("guidelines.enforcementLimits")}
          </p>
        </div>
      </section>

      <p className="mt-6 px-4 pb-4 text-sm leading-6">
        {t("guidelines.footer")}{" "}
        <Link href="/support" className="text-brand-link underline">
          {t("faq.footerLink")}
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="text-brand-link underline">
          {t("guidelines.termsLink")}
        </Link>
      </p>
    </AppPage>
  );
}
