import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { SupportForm } from "@/components/support/SupportForm";
import { getSessionUser } from "@/lib/auth/session";
import { getProfileById } from "@/lib/profiles/queries";
import { isSupportEmailConfigured } from "@/lib/support/email";

// Reads the session to prefill and to link the ticket to a profile.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Support",
  description: "Send the Scrlpets team a question or a problem report.",
};

export default async function SupportPage() {
  const t = await getTranslations("support");
  const user = await getSessionUser();
  const profile = user ? await getProfileById(user.id) : null;
  const emailConfigured = isSupportEmailConfigured();

  return (
    <AppPage>
      <header className="flex items-center justify-between px-4 pb-3 pt-6">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        </div>
        <Link href="/menu" className="text-sm text-brand-link underline">
          {t("back")}
        </Link>
      </header>

      <section className="px-4">
        <p className="text-sm leading-6 text-muted-foreground">{t("intro")}</p>
      </section>

      {/* Honest expectations, before the form rather than after it. */}
      <section className="mt-5 px-4">
        <div className="rounded-2xl border border-border/70 bg-muted/35 p-4" data-testid="support-expectations">
          <p className="eyebrow">{t("nextTitle")}</p>
          <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>{t("next1")}</li>
            <li>{t("next2")}</li>
            <li>{t("next3")}</li>
            {!emailConfigured && (
              <li data-testid="support-email-not-configured">{t("next4NoEmail")}</li>
            )}
          </ul>
        </div>
      </section>

      <section className="mt-5 px-4">
        <SupportForm
          signedIn={Boolean(user)}
          defaultName={profile?.displayName ?? profile?.username ?? ""}
          defaultEmail={user?.email ?? ""}
        />
      </section>

      <section className="mt-6 px-4 pb-4">
        <p className="text-sm leading-6 text-muted-foreground">
          {t("elsewhere")}{" "}
          <Link href="/faq" className="text-brand-link underline">
            {t("faqLink")}
          </Link>{" "}
          ·{" "}
          <Link href="/guidelines" className="text-brand-link underline">
            {t("guidelinesLink")}
          </Link>{" "}
          ·{" "}
          <Link href="/guides" className="text-brand-link underline">
            {t("guidesLink")}
          </Link>
        </p>
      </section>
    </AppPage>
  );
}
