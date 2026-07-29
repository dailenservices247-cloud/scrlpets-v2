import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { getBreedingEvents, getGestationDays, getMyCreatures } from "@/lib/breeding/queries";
import { BreedingCalendarClient } from "@/components/calendar/BreedingCalendarClient";

export const dynamic = "force-dynamic";


export const metadata = {
  title: "Breeding Calendar",
  description: "Track heats, matings, and expected due dates for your animals.",
};

export default async function CalendarPage() {
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor("/calendar"));

  const t = await getTranslations("calendar");
  const [events, creatures, gestationDays] = await Promise.all([
    getBreedingEvents(),
    getMyCreatures(),
    getGestationDays(),
  ]);

  return (
    <AppPage>
      <header className="px-3 pb-3 pt-4">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>
      <BreedingCalendarClient events={events} creatures={creatures} gestationDays={gestationDays} />
    </AppPage>
  );
}
