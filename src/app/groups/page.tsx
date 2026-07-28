import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { listGroups } from "@/lib/groups/queries";

export const metadata = {
  title: "Groups",
  description: "Breed and species communities on Scrlpets.",
};

// Scope lock: every group is one breed or one species. The subtitle says so on
// the first screen, because the fastest way to lose that scope is to leave it
// implicit and let the first "Off topic" request feel reasonable.
export default async function GroupsPage() {
  const t = await getTranslations("groups");
  const groups = await listGroups();

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground" data-testid="groups-scope-notice">
          {t("scopeNotice")}
        </p>
      </section>

      <div className="px-4 pb-8">
        {groups.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground" data-testid="groups-empty">
            {t("empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="groups-list">
            {groups.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/groups/${g.slug}`}
                  className="block rounded-2xl border bg-card p-4 transition hover:border-primary/40"
                  data-testid="group-card"
                >
                  <p className="eyebrow">{g.species}</p>
                  <p className="mt-1 font-semibold">{g.name}</p>
                  {g.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("memberCount", { count: g.memberCount })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppPage>
  );
}
