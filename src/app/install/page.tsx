import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Check, X } from "lucide-react";
import { AppPage } from "@/components/app/AppPage";
import { InstallPrompt } from "./InstallPrompt";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("install");
  return { title: t("title"), description: t("body") };
}

/**
 * The honest install page. Installing gives a home-screen icon and a
 * chrome-less window — that is the whole feature. Offline and push are banked,
 * so this page says so out loud rather than letting "install" imply them.
 */
export default async function InstallPage() {
  const t = await getTranslations("install");
  const gets = ["getIcon", "getWindow", "getSameAccount"] as const;
  const notGets = ["notOffline", "notPush", "notFaster"] as const;
  const steps = ["stepIos", "stepAndroid", "stepDesktop"] as const;

  return (
    <AppPage>
      <header className="px-4 pb-3 pt-8">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("body")}</p>
      </header>

      <section className="px-4">
        <InstallPrompt />
      </section>

      <section className="px-4 pt-6" data-testid="install-truth">
        <div className="premium-panel rounded-2xl p-4">
          <h2 className="text-sm font-semibold">{t("getsTitle")}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {gets.map((key) => (
              <li key={key} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                <Check className="mt-1 size-4 shrink-0 text-brand-link" aria-hidden />
                {t(key)}
              </li>
            ))}
          </ul>

          <h2 className="mt-5 text-sm font-semibold">{t("notGetsTitle")}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {notGets.map((key) => (
              <li key={key} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                <X className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-6">
        <div className="premium-panel rounded-2xl p-4">
          <h2 className="text-sm font-semibold">{t("stepsTitle")}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {steps.map((key) => (
              <li key={key} className="text-sm leading-6 text-muted-foreground">
                {t(key)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("browserNote")}</p>
        </div>
      </section>
    </AppPage>
  );
}
