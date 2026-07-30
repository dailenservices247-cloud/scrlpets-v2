import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { AlumniTimeline } from "@/components/alumni/AlumniTimeline";
import { AlumniUpdateForm } from "@/components/alumni/AlumniUpdateForm";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { getAlumniRecord, listAlumniUpdates } from "@/lib/alumni/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Alumni updates",
};

export default async function AlumniRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor(`/pack/alumni/${id}`));
  const t = await getTranslations("alumni");
  const record = await getAlumniRecord(id, user.id);
  // Non-parties get a plain not-found rather than a "forbidden" that confirms
  // the record exists.
  if (!record) notFound();
  const updates = await listAlumniUpdates(record);
  const counterpartyName = record.counterparty
    ? (record.counterparty.displayName ?? record.counterparty.username)
    : t("unknownParty");

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <Link href="/pack/alumni" className="text-sm text-brand-link underline">
          {t("backToAlumni")}
        </Link>
        {/* Species-adapted, from lib/species/identity: "Cattery" for a cat,
            "Aviary" for a bird, "Breeder" when the species is unknown. The
            entries below stay plain "updates", so no dog-shaped word is ever
            needed to name what this surface is. */}
        <p className="eyebrow mt-4" data-testid="alumni-role-badge">
          {record.breederRoleBadge}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight" data-testid="alumni-animal-name">
          {record.creature?.name ?? t("animalGone")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(record.viewerSide === "breeder" ? "sideNowWith" : "sideRaisedBy", {
            name: counterpartyName,
          })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("handoverAt", { date: new Date(record.handoverAt) })}
        </p>
        {record.creature && (
          <Link
            href={`/c/${record.creature.slug}`}
            className="mt-3 inline-block text-sm text-brand-link underline"
            data-testid="alumni-view-animal"
          >
            {t("viewAnimal", { name: record.creature.name })}
          </Link>
        )}
      </section>

      {record.creature ? (
        <section className="border-y border-border/60 px-4 py-4">
          <AlumniUpdateForm
            alumniId={record.id}
            animalName={record.creature.name}
            userId={user.id}
          />
        </section>
      ) : (
        <p
          className="border-y border-border/60 px-4 py-4 text-sm text-muted-foreground"
          data-testid="alumni-no-animal"
        >
          {t("animalGoneBody")}
        </p>
      )}

      <section className="px-4 py-6" aria-labelledby="alumni-updates-heading">
        <h2 id="alumni-updates-heading" className="pb-2 text-sm font-semibold">
          {t("updatesTitle")}
        </h2>
        <AlumniTimeline record={record} updates={updates} viewerId={user.id} />
      </section>
    </AppPage>
  );
}
