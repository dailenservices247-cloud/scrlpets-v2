import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BookOpen, ChevronRight, Store, Tag, Users } from "lucide-react";
import { AppPage } from "@/components/app/AppPage";

// Discover survives as a route but is no longer a bottom-nav slot — shop,
// adopt and services merged into /market, and Groups and Guides are community
// surfaces rather than marketplace ones. The offer entry is UNCONDITIONAL:
// /brand-os was the only Service-creation surface and the menu hid it behind
// an operator check, so a groomer with no animals and no brand could never
// find it.
const destinations = [
  { href: "/market", key: "market", icon: Store },
  { href: "/groups", key: "groups", icon: Users },
  { href: "/guides", key: "guides", icon: BookOpen },
  { href: "/market/offer", key: "offer", icon: Tag },
] as const;

export default async function DiscoverPage() {
  const t = await getTranslations("nav");

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <p className="eyebrow">{t("discoverHub.eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("discoverHub.title")}</h1>
      </section>

      <section className="flex flex-col gap-3 px-4 pb-8" data-testid="discover-cards">
        {destinations.map(({ href, key, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="premium-panel flex items-center gap-4 rounded-2xl p-4 transition hover:border-primary/40"
            data-testid={`discover-card-${key}`}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-brand-link">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold">{t(`discoverHub.${key}.label`)}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {t(`discoverHub.${key}.description`)}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </section>
    </AppPage>
  );
}
