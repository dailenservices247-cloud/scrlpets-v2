import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { getBreedingEvents, getGestationDays, getMyCreatures, type BreedingEvent } from "@/lib/breeding/queries";
import { type BreedingEventType } from "@/lib/breeding/constants";
import { listMyLitters } from "@/lib/litters/queries";
import { BreedingCalendarClient } from "@/components/calendar/BreedingCalendarClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Breeding & Operations Calendar",
  description: "Track heats, matings, due dates, scheduled handovers, and transport on Scrlpets.",
};

export default async function CalendarPage() {
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor("/calendar"));

  const t = await getTranslations("calendar");
  const supabase = await createClient();

  const [events, creatures, gestationDays, litters, contractsRes, quotesRes] = await Promise.all([
    getBreedingEvents(),
    getMyCreatures(),
    getGestationDays(),
    listMyLitters(user.id),
    supabase
      .from("deal_contracts")
      .select("id,creature_id,go_home_date,status,listings(title)")
      .not("go_home_date", "is", null)
      .in("status", ["sent", "signed"]),
    supabase
      .from("transport_quotes")
      .select("id,target_pickup_date,pickup_region,delivery_region,status")
      .not("target_pickup_date", "is", null)
      .in("status", ["requested", "quoted", "accepted"]),
  ]);

  const litterEvents: BreedingEvent[] = litters
    .filter((l) => l.expectedDate || l.birthDate)
    .map((l) => ({
      id: `litter-${l.id}`,
      creatureId: l.damId ?? l.sireId ?? (creatures[0]?.id ?? ""),
      partnerCreatureId: l.sireId ?? null,
      eventType: (l.status === "born" ? "birth" : "ultrasound") as BreedingEventType,
      eventDate: (l.birthDate || l.expectedDate)!,
      expectedDueDate: l.expectedDate,
      notes: `${l.name} (${l.breed ?? "Litter"})`,
    }));

  const contractEvents: BreedingEvent[] = (
    (contractsRes.data ?? []) as unknown as {
      id: string;
      creature_id: string | null;
      go_home_date: string;
      status: string;
      listings: { title: string } | null;
    }[]
  ).map((c) => ({
    id: `contract-${c.id}`,
    creatureId: c.creature_id ?? (creatures[0]?.id ?? ""),
    partnerCreatureId: null,
    eventType: "show" as BreedingEventType,
    eventDate: c.go_home_date,
    expectedDueDate: null,
    notes: `🏡 Go-Home Handover (${c.status}): ${c.listings?.title ?? "Deal Contract"}`,
  }));

  const transportEvents: BreedingEvent[] = (
    (quotesRes.data ?? []) as {
      id: string;
      target_pickup_date: string;
      pickup_region: string;
      delivery_region: string;
      status: string;
    }[]
  ).map((q) => ({
    id: `transport-${q.id}`,
    creatureId: creatures[0]?.id ?? "",
    partnerCreatureId: null,
    eventType: "training" as BreedingEventType,
    eventDate: q.target_pickup_date,
    expectedDueDate: null,
    notes: `🚗 Transport (${q.status}): ${q.pickup_region} ➔ ${q.delivery_region}`,
  }));

  const allEvents = [...events, ...litterEvents, ...contractEvents, ...transportEvents];

  return (
    <AppPage>
      <header className="px-3 pb-3 pt-4">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>
      <BreedingCalendarClient events={allEvents} creatures={creatures} gestationDays={gestationDays} />
    </AppPage>
  );
}
