import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { PackMemberList } from "@/components/pack/PackMemberList";
import { PackRequestControls } from "@/components/pack/PackRequestActions";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { getPackOverview } from "@/lib/pack/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pack",
  description: "The people you are connected to on Scrlpets.",
};

/**
 * "Pack" is the platform-wide word for the people graph, for every species —
 * so this heading is a fixed term, not species-derived. `speciesIdentity`'s
 * groupName ("My Clowder", "My Aviary") names a set of ANIMALS and is used on
 * the Ecosystem Tree; applying it to a list of people would be wrong. Species
 * vocabulary adapts on the alumni surface, where the animal is the subject.
 *
 * /pack is not in PROTECTED_PREFIXES (src/lib/auth/access.ts is another lane's
 * file), so the page does its own redirect rather than assuming the proxy.
 */
export default async function PackPage() {
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor("/pack"));
  const [t, overview] = await Promise.all([
    getTranslations("pack"),
    getPackOverview(user.id),
  ]);

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground" data-testid="pack-subtitle">
          {t("subtitle")}
        </p>
        <Link
          href="/pack/alumni"
          className="mt-4 block rounded-2xl border bg-card p-4 transition hover:border-primary/40"
          data-testid="pack-alumni-link"
        >
          <p className="font-semibold text-brand-link">{t("alumniLink")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("alumniLinkBody")}</p>
        </Link>
      </section>

      <section className="px-4 pb-6" aria-labelledby="pack-requests-heading">
        <h2 id="pack-requests-heading" className="pb-2 text-sm font-semibold">
          {t("requestsTitle")}
        </h2>
        {overview.incoming.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="pack-requests-empty">
            {t("requestsEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="pack-requests-list">
            {overview.incoming.map((r) => (
              <li key={r.linkId} className="premium-panel rounded-2xl p-4" data-testid="pack-request-row">
                <p className="text-sm">
                  {t("requestFrom", { username: r.username })}
                </p>
                {/* The page already knows this row is pending and addressed to
                    the viewer, so it renders the controls directly instead of
                    paying for PackRequestActions' re-read. */}
                <PackRequestControls linkId={r.linkId} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="px-4 pb-8" aria-labelledby="pack-members-heading">
        <h2 id="pack-members-heading" className="pb-2 text-sm font-semibold">
          {t("membersTitle")}
        </h2>
        <PackMemberList members={overview.members} />
      </section>
    </AppPage>
  );
}
