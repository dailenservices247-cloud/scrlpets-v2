import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { ReferralPanel } from "@/components/referral/ReferralPanel";
import { ReferralShare } from "@/components/referral/ReferralShare";
import { ClaimReferralForm } from "@/components/referral/ClaimReferralForm";
import { getMyReferralCode, getMyReferralStats, getMyReferrerCode } from "@/lib/referrals/queries";
import { getSessionUser } from "@/lib/auth/session";

// Same fallback as robots.ts / sitemap.ts — the link is pasted into other
// people's apps, so it can never be a relative path or a preview host.
const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://scrlpets-v2.vercel.app"
).replace(/\/$/, "");

// Inviting someone is worth points; sending a link is not. The distinction is
// enforced in the database and stated on the page.
export default async function ReferralsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [t, code, stats, referrerCode] = await Promise.all([
    getTranslations("referrals"),
    getMyReferralCode(),
    getMyReferralStats(),
    getMyReferrerCode(),
  ]);
  const link = code ? `${BASE_URL}/signup?ref=${encodeURIComponent(code)}` : null;

  return (
    <AppPage>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Invite trusted breeders and companion owners to earn pack credits.
            </p>
          </div>
          <Link
            href="/settings"
            className="grid size-9 place-items-center rounded-xl border border-border/70 bg-card/60 text-muted-foreground transition hover:border-border hover:bg-muted/60 hover:text-foreground"
            aria-label="Back to settings"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </header>
        <div className="flex flex-col gap-4 pb-6">
          <ClaimReferralForm claimedCode={referrerCode} />
          <ReferralPanel link={link} stats={stats} />
          <ReferralShare link={link} />
        </div>
      </div>
    </AppPage>
  );
}
