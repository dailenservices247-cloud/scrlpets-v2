import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { AlumniCard } from "@/components/alumni/AlumniCard";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { listAlumni } from "@/lib/alumni/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Alumni",
  description: "Animals that changed hands, and the updates that followed.",
};

export default async function AlumniPage() {
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor("/pack/alumni"));
  const [t, records] = await Promise.all([getTranslations("alumni"), listAlumni(user.id)]);
  const active = records.filter((r) => !r.muted);
  const muted = records.filter((r) => r.muted);

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <Link href="/pack" className="text-sm text-brand-link underline">
          {t("back")}
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground" data-testid="alumni-subtitle">
          {t("subtitle")}
        </p>
      </section>

      <div className="px-4 pb-8">
        {active.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground" data-testid="alumni-empty">
            {t("empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="alumni-list">
            {active.map((r) => (
              <AlumniCard key={r.id} record={r} />
            ))}
          </ul>
        )}

        {/* Muted records stay reachable behind a native disclosure. Hiding them
            outright would strand the unmute, and the mute is the viewer's own
            filter — the other side still has theirs. */}
        {muted.length > 0 && (
          <details className="mt-6 rounded-2xl border bg-card p-4" data-testid="alumni-muted">
            <summary className="cursor-pointer text-sm font-semibold">
              {t("mutedTitle", { count: muted.length })}
            </summary>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("mutedBody")}</p>
            <ul className="mt-3 flex flex-col gap-3">
              {muted.map((r) => (
                <AlumniCard key={r.id} record={r} />
              ))}
            </ul>
          </details>
        )}
      </div>
    </AppPage>
  );
}
