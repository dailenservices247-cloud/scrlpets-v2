import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { WaitlistForm } from "./WaitlistForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("waitlist");
  return { title: t("title"), description: t("body") };
}

const SOURCE_RE = /^[a-z0-9_-]{1,40}$/;

/**
 * The pre-launch front door. Outside traffic (the Husbandry channel first)
 * lands here with `?src=<campaign>`; the slug rides the signup row so each
 * door can be judged by what it actually brought in.
 */
export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  const { src } = await searchParams;
  const source = src && SOURCE_RE.test(src) ? src : "direct";
  const t = await getTranslations("waitlist");

  return (
    <AppPage>
      <header className="px-4 pb-3 pt-8">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("body")}
        </p>
      </header>
      <section className="px-4 pb-10">
        <WaitlistForm source={source} />
      </section>
    </AppPage>
  );
}
