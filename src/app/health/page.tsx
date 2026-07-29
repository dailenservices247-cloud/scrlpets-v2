import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { getMyCreatures, getReminders } from "@/lib/health/queries";
import { HealthCenterClient } from "@/components/health/HealthCenterClient";

export const dynamic = "force-dynamic";


export const metadata = {
  title: "Pet Health Center",
  description: "Vaccinations, vet visits, medication, and grooming reminders for your animals.",
};

export default async function HealthPage() {
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor("/health"));

  const t = await getTranslations("health");
  const [reminders, creatures] = await Promise.all([getReminders(), getMyCreatures()]);

  return (
    <AppPage>
      <header className="px-3 pb-3 pt-4">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>
      <HealthCenterClient reminders={reminders} creatures={creatures} />
    </AppPage>
  );
}
