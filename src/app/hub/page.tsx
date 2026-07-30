import Link from "next/link";
import { Building2, CalendarDays, LogIn, Network, PawPrint } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { getHubSummary } from "@/lib/hub/queries";
import { BRAND_TYPE_OPTIONS } from "@/lib/brands/types";
import type { BrandType } from "@/lib/brands/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Operator Hub",
  description: "Your animals, litters, calendar, and brands in one place.",
};

function typeLabel(value: BrandType): string {
  return BRAND_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? "Brand";
}

// R2 — Operator Hub: person-scoped, cross-brand launcher + summary. A solo
// breeder with no brand still gets full value here (stat row + tree/litters/
// calendar cards); brands only add cards on top.
// Not middleware-gated (see src/lib/auth/access.ts) — renders its own
// sign-in prompt, matching /tree and /litters.
export default async function HubPage() {
  const t = await getTranslations("hub");
  const user = await getSessionUser();

  if (!user) {
    return (
      <AppPage>
        <section className="px-3 pb-3 pt-4" data-testid="hub-signin-prompt">
          <div className="premium-panel rounded-2xl p-6 text-center">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl border border-accent/35 bg-accent/15 text-accent">
              <LogIn className="size-7" aria-hidden />
            </div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-1 text-2xl font-semibold">{t("signInTitle")}</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {t("signInBody")}
            </p>
            <Link
              href={loginHrefFor("/hub")}
              data-testid="hub-signin-cta"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
            >
              {t("signInCta")}
            </Link>
          </div>
        </section>
      </AppPage>
    );
  }

  const summary = await getHubSummary(user.id);
  const stats = [
    { key: "animals", value: summary.animalCount, label: t("statAnimals") },
    { key: "litters", value: summary.litterCount, label: t("statLitters") },
    { key: "events", value: summary.upcomingEventCount, label: t("statEvents") },
  ];
  const launcherCards = [
    { key: "tree", href: "/tree", icon: Network, label: t("cardTreeLabel"), body: t("cardTreeBody") },
    { key: "litters", href: "/litters", icon: PawPrint, label: t("cardLittersLabel"), body: t("cardLittersBody") },
    { key: "calendar", href: "/calendar", icon: CalendarDays, label: t("cardCalendarLabel"), body: t("cardCalendarBody") },
  ];

  return (
    <AppPage>
      <section className="px-3 pb-3 pt-4">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("subtitle")}</p>
      </section>

      <section className="px-3 py-3">
        <div className="grid grid-cols-3 gap-2" data-testid="hub-stats">
          {stats.map((stat) => (
            <div key={stat.key} className="rounded-xl border border-border/70 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold" data-testid={`hub-stat-${stat.key}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-3 py-3" data-testid="hub-launcher">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {launcherCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.key}
                href={card.href}
                data-testid={`hub-card-${card.key}`}
                className="premium-panel rounded-2xl p-4 transition hover:border-primary/40"
              >
                <span className="mb-3 grid size-10 place-items-center rounded-full bg-background/65 text-brand-link">
                  <Icon className="size-5" aria-hidden />
                </span>
                <p className="text-base font-semibold">{card.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.body}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {summary.brands.length > 0 && (
        <section className="px-3 py-3" data-testid="hub-brands">
          <p className="eyebrow mb-3">{t("brandsEyebrow")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {summary.brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/brand-os?brand=${brand.id}`}
                data-testid="hub-brand-card"
                className="premium-panel rounded-2xl p-3 transition hover:border-primary/40"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-accent/35 bg-accent/15 text-accent">
                    <Building2 className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{brand.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{typeLabel(brand.brandType)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </AppPage>
  );
}
