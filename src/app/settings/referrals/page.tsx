import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { ReferralPanel } from "@/components/referral/ReferralPanel";
import { ReferralShare } from "@/components/referral/ReferralShare";
import { getMyReferralCode, getMyReferralStats } from "@/lib/referrals/queries";
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

  const [t, code, stats] = await Promise.all([
    getTranslations("referrals"),
    getMyReferralCode(),
    getMyReferralStats(),
  ]);
  const link = code ? `${BASE_URL}/signup?ref=${encodeURIComponent(code)}` : null;

  return (
    <AppPage>
      <header className="flex items-center justify-between px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link href="/menu" className="text-sm text-brand-link underline">
          {t("back")}
        </Link>
      </header>
      <div className="flex flex-col gap-4 px-3 pb-6">
        <ReferralPanel link={link} stats={stats} />
        <ReferralShare link={link} />
      </div>
    </AppPage>
  );
}
