import Link from "next/link";
import { ChevronRight, PawPrint, Scissors, Store, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";

export const metadata = {
  title: "Sell or offer a service",
  description: "The four ways to offer something on Scrlpets.",
};

/**
 * The one discoverable way to offer something. Before this, /brand-os was the
 * only Service-creation surface and the menu hid it behind an operator check,
 * so the only non-circular path in was four taps deep inside a collapsed
 * disclosure in the composer. This page is deliberately UNGATED: the
 * destinations enforce their own auth, and a chooser that hides the option you
 * do not have yet is the bug it replaces.
 *
 * ponytail: an animal listing and a supplies listing are the same composer mode
 * (a product is a listing with no animal attached), so both rows land on
 * /compose?mode=listing. Split them when the composer grows a real product mode
 * — today its Product tab is live:false.
 */
const options = [
  { key: "animal", href: "/compose?mode=listing", icon: PawPrint },
  { key: "supplies", href: "/compose?mode=listing", icon: Store },
  { key: "service", href: "/brand-os", icon: Scissors },
  { key: "litter", href: "/litters", icon: Users },
] as const;

export default async function MarketOfferPage() {
  const t = await getTranslations("market.offer");

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("body")}</p>
      </section>

      <section className="flex flex-col gap-3 px-4 pb-8" data-testid="offer-options">
        {options.map(({ key, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className="premium-panel flex items-center gap-4 rounded-2xl p-4 transition hover:border-primary/40"
            data-testid={`offer-option-${key}`}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-brand-link">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold">{t(`${key}.label`)}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {t(`${key}.description`)}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </section>
    </AppPage>
  );
}
