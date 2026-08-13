import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  BadgeCheck,
  Banknote,
  ChevronRight,
  CircleUser,
  CreditCard,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { AppPage } from "@/components/app/AppPage";

export default async function SettingsIndexPage() {
  const [tProfile, tAccount, tVerification, tSubscriptions, tReferrals, tPayouts] =
    await Promise.all([
      getTranslations("profile"),
      getTranslations("account"),
      getTranslations("verification"),
      getTranslations("subscriptions"),
      getTranslations("referrals"),
      getTranslations("payouts"),
    ]);

  // R5: the menu's settings rows consolidate into this one index.
  const rows = [
    { href: "/settings/profile", icon: CircleUser, label: tProfile("profileLabel") },
    { href: "/settings/account", icon: ShieldCheck, label: tAccount("title") },
    { href: "/settings/verification", icon: BadgeCheck, label: tVerification("title") },
    { href: "/settings/subscription", icon: CreditCard, label: tSubscriptions("title") },
    // Sits next to verification on purpose: both are gates on selling an animal,
    // and a seller blocked by one is usually about to hit the other.
    { href: "/settings/payouts", icon: Banknote, label: tPayouts("title") },
    { href: "/settings/referrals", icon: UserPlus, label: tReferrals("title") },
  ];

  return (
    <AppPage>
      <header className="flex items-center justify-between px-4 pb-3 pt-6">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <Link href="/menu" className="text-sm text-brand-link underline">
          {tAccount("back")}
        </Link>
      </header>

      <section className="px-4 pb-8">
        <div className="premium-panel rounded-2xl p-2" data-testid="settings-rows">
          {rows.map((row) => (
            <Link
              key={row.href}
              href={row.href}
              className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-muted/60"
              data-testid={`settings-row-${row.href.split("/").pop()}`}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background/65 text-brand-link">
                <row.icon className="size-4" aria-hidden />
              </span>
              <span className="flex-1 text-[15px] font-medium">{row.label}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </div>
      </section>
    </AppPage>
  );
}
