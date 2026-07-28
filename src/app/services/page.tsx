import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { formatPrice } from "@/lib/shop/format";
import { listServiceCategories, listServices } from "@/lib/services/queries";

export const metadata = {
  title: "Services",
  description: "Grooming, training, boarding, transport and veterinary providers on Scrlpets.",
};

// R17: providers list while unverified, and every card states the truth about
// that provider rather than implying Scrlpets vetted them.
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const t = await getTranslations("services");
  const [services, categories] = await Promise.all([
    listServices(category),
    listServiceCategories(),
  ]);

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground" data-testid="services-notice">
          {t("vettingNotice")}
        </p>
      </section>

      {categories.length > 0 && (
        <nav className="flex gap-2 overflow-x-auto px-4 pb-4" aria-label={t("categories")}>
          <Link
            href="/services"
            className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-sm ${!category ? "border-primary bg-primary/10" : "border-input"}`}
          >
            {t("allCategories")}
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={`/services?category=${encodeURIComponent(c)}`}
              className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-sm ${category === c ? "border-primary bg-primary/10" : "border-input"}`}
            >
              {t(`category.${c}`)}
            </Link>
          ))}
        </nav>
      )}

      <div className="px-4 pb-8">
        {services.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground" data-testid="services-empty">
            {t("empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="services-list">
            {services.map((s) => (
              <li key={s.id} className="rounded-2xl border bg-card p-4" data-testid="service-card">
                <div className="flex flex-wrap items-center gap-2">
                  {s.category && <span className="eyebrow">{t(`category.${s.category}`)}</span>}
                  {s.ownerVerified ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-md border border-secondary/40 bg-secondary/15 px-2 py-0.5 text-xs text-secondary-foreground"
                      data-testid={`service-verified-${s.id}`}
                    >
                      <BadgeCheck className="size-3.5" aria-hidden />
                      {t("providerVerified")}
                    </span>
                  ) : (
                    <span
                      className="rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground"
                      data-testid={`service-unverified-${s.id}`}
                    >
                      {t("providerUnverified")}
                    </span>
                  )}
                </div>
                <p className="mt-2 font-semibold">{s.name}</p>
                {s.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {s.area && <span>{s.area}</span>}
                  <span>
                    {s.priceCents !== null && s.priceCents > 0
                      ? formatPrice(s.priceCents, s.currency)
                      : t("contactForQuote")}
                  </span>
                  {s.brand ? (
                    <Link href={`/b/${s.brand.slug}`} className="text-brand-link underline">
                      {s.brand.name}
                    </Link>
                  ) : (
                    <Link href={`/u/${s.ownerUsername}`} className="text-brand-link underline">
                      @{s.ownerUsername}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppPage>
  );
}
