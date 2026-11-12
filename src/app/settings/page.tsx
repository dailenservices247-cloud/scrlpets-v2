import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  BadgeCheck,
  Banknote,
  Bell,
  BookOpen,
  ChevronRight,
  CircleUser,
  CreditCard,
  Eye,
  FileText,
  Languages,
  Lock,
  Scale,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { AppPage } from "@/components/app/AppPage";

export const metadata = {
  title: "Settings & Privacy | Scrlpets",
  description: "Manage profile, preferences, regional settings, security, and breeding monetization.",
};

export default async function SettingsIndexPage() {
  const t = await getTranslations("settings");

  const groups = [
    {
      title: t("groups.account"),
      rows: [
        {
          href: "/settings/profile",
          testid: "settings-row-profile",
          icon: CircleUser,
          title: t("rows.profile.title"),
          subtitle: t("rows.profile.subtitle"),
          color: "text-brand-link bg-primary/10",
        },
        {
          href: "/settings/account",
          testid: "settings-row-account",
          icon: ShieldCheck,
          title: t("rows.account.title"),
          subtitle: t("rows.account.subtitle"),
          color: "text-brand-link bg-primary/10",
        },
        {
          href: "/settings/verification",
          testid: "settings-row-verification",
          icon: BadgeCheck,
          title: t("rows.verification.title"),
          subtitle: t("rows.verification.subtitle"),
          color: "text-secondary-foreground bg-secondary/15",
        },
      ],
    },
    {
      title: t("groups.experience"),
      rows: [
        {
          href: "/settings/preferences",
          testid: "settings-row-preferences",
          icon: Languages,
          title: t("rows.preferences.title"),
          subtitle: t("rows.preferences.subtitle"),
          color: "text-brand-link bg-primary/10",
        },
        {
          href: "/settings/notifications",
          testid: "settings-row-notifications",
          icon: Bell,
          title: t("rows.notifications.title"),
          subtitle: t("rows.notifications.subtitle"),
          color: "text-secondary-foreground bg-secondary/15",
        },
        {
          href: "/settings/privacy",
          testid: "settings-row-privacy",
          icon: Eye,
          title: t("rows.privacy.title"),
          subtitle: t("rows.privacy.subtitle"),
          color: "text-foreground bg-muted",
        },
      ],
    },
    {
      title: t("groups.commerce"),
      rows: [
        {
          href: "/settings/creator",
          testid: "settings-row-creator",
          icon: Sparkles,
          title: "Creator Studio & Monetization",
          subtitle: "Video reels, fan tipping, ad-revenue share, and Relay Financial direct deposits",
          color: "text-amber-400 bg-amber-500/15",
        },
        {
          href: "/settings/payouts",
          testid: "settings-row-payouts",
          icon: Banknote,
          title: t("rows.payouts.title"),
          subtitle: t("rows.payouts.subtitle"),
          color: "text-secondary-foreground bg-secondary/15",
        },
        {
          href: "/settings/subscription",
          testid: "settings-row-subscription",
          icon: CreditCard,
          title: t("rows.subscription.title"),
          subtitle: t("rows.subscription.subtitle"),
          color: "text-brand-link bg-primary/10",
        },
        {
          href: "/settings/referrals",
          testid: "settings-row-referrals",
          icon: UserPlus,
          title: t("rows.referrals.title"),
          subtitle: t("rows.referrals.subtitle"),
          color: "text-foreground bg-muted",
        },
      ],
    },
    {
      title: t("groups.legal"),
      rows: [
        {
          href: "/guides/animal-legality",
          testid: "settings-row-animal-legality",
          icon: Scale,
          title: t("rows.animalLegality.title"),
          subtitle: t("rows.animalLegality.subtitle"),
          color: "text-secondary-foreground bg-secondary/15",
        },
        {
          href: "/guidelines",
          testid: "settings-row-guidelines",
          icon: BookOpen,
          title: t("rows.guidelines.title"),
          subtitle: t("rows.guidelines.subtitle"),
          color: "text-foreground bg-muted",
        },
        {
          href: "/terms",
          testid: "settings-row-terms",
          icon: FileText,
          title: t("rows.terms.title"),
          subtitle: t("rows.terms.subtitle"),
          color: "text-foreground bg-muted",
        },
        {
          href: "/privacy",
          testid: "settings-row-privacy-policy",
          icon: Lock,
          title: t("rows.privacyPolicy.title"),
          subtitle: t("rows.privacyPolicy.subtitle"),
          color: "text-foreground bg-muted",
        },
      ],
    },
  ];

  return (
    <AppPage>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
              {t("title")}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
          <Link
            href="/menu"
            className="rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {t("back")}
          </Link>
        </header>

        <div className="space-y-6" data-testid="settings-rows">
          {groups.map((group) => (
            <div key={group.title} className="space-y-2">
              <h2 className="px-1 text-micro font-bold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h2>
              <div className="premium-panel divide-y divide-border/40 overflow-hidden rounded-2xl">
                {group.rows.map((row) => (
                  <Link
                    key={row.href}
                    href={row.href}
                    className="flex min-h-14 items-center gap-3.5 px-4 py-3 transition hover:bg-muted/50"
                    data-testid={row.testid}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl ${row.color}`}
                    >
                      <row.icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-ui font-semibold text-foreground leading-tight">
                        {row.title}
                      </div>
                      <div className="mt-0.5 text-micro text-muted-foreground leading-normal truncate">
                        {row.subtitle}
                      </div>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground/70"
                      aria-hidden
                    />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppPage>
  );
}
