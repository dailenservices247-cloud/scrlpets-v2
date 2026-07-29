import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getLitterYoung, getPublicLitter } from "@/lib/litters/queries";

export const dynamic = "force-dynamic";


export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const litter = await getPublicLitter(id);
  if (!litter) return {};
  return {
    title: litter.name,
    description: `${litter.name}${litter.species ? ` — ${litter.species}` : ""} on Scrlpets.`,
  };
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function LitterPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("litters");
  const litter = await getPublicLitter(id);
  if (!litter) notFound();
  const young = await getLitterYoung(id);

  const expected = formatDate(litter.expectedDate);
  const born = formatDate(litter.birthDate);

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="eyebrow">{t("publicEyebrow")}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight" data-testid="litter-public-name">
              {litter.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {litter.species ? t(`species.${litter.species}`) : t("speciesUnset")}
              {litter.breed ? ` · ${litter.breed}` : ""}
            </p>
          </div>
          <span
            className="shrink-0 rounded-md border border-input px-2 py-1 text-xs text-muted-foreground"
            data-testid="litter-status-chip"
          >
            {t(`status.${litter.status}`)}
          </span>
        </div>

        {(expected || born) && (
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {expected && (
              <span>
                {t("expected")}: {expected}
              </span>
            )}
            {born && (
              <span>
                {t("born")}: {born}
              </span>
            )}
          </p>
        )}

        {litter.description && (
          <p className="mt-3 text-sm leading-6" data-testid="litter-public-description">
            {litter.description}
          </p>
        )}

        <p className="mt-3 text-xs text-muted-foreground" data-testid="litter-attribution">
          {litter.brand ? (
            <>
              {t("postedBy")}{" "}
              <Link href={`/b/${litter.brand.slug}`} className="text-brand-link underline">
                {litter.brand.name}
              </Link>
            </>
          ) : litter.owner ? (
            <>
              {t("postedBy")}{" "}
              <Link href={`/u/${litter.owner.username}`} className="text-brand-link underline">
                @{litter.owner.username}
              </Link>
            </>
          ) : null}
        </p>
      </section>

      {(litter.dam || litter.sire) && (
        <section className="px-4 pb-4" data-testid="litter-parents">
          <p className="eyebrow mb-2">{t("parents")}</p>
          <div className="grid grid-cols-2 gap-3">
            {litter.dam && (
              <Link
                href={`/c/${litter.dam.slug}`}
                className="premium-panel rounded-xl p-3 hover:border-primary/40"
                data-testid="litter-dam-card"
              >
                <p className="text-xs text-muted-foreground">{t("dam")}</p>
                <p className="mt-1 truncate text-sm font-semibold">{litter.dam.name}</p>
              </Link>
            )}
            {litter.sire && (
              <Link
                href={`/c/${litter.sire.slug}`}
                className="premium-panel rounded-xl p-3 hover:border-primary/40"
                data-testid="litter-sire-card"
              >
                <p className="text-xs text-muted-foreground">{t("sire")}</p>
                <p className="mt-1 truncate text-sm font-semibold">{litter.sire.name}</p>
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="px-4 pb-8">
        <p className="eyebrow mb-2">{t("youngGrid")}</p>
        {young.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="litter-young-empty">
            {t("noYoung")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3" data-testid="litter-young-grid">
            {young.map((y) => (
              <div key={y.id} className="premium-panel rounded-xl p-3" data-testid="litter-young-card">
                <Link href={`/c/${y.slug}`} className="block hover:underline">
                  <p className="truncate text-sm font-semibold">{y.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {y.species ? t(`species.${y.species}`) : t("speciesUnset")}
                  </p>
                </Link>
                {y.listingId && (
                  <Link
                    href={`/listing/${y.listingId}`}
                    className="mt-2 inline-block rounded-md border border-secondary/40 bg-secondary/15 px-2 py-0.5 text-xs text-secondary-foreground"
                    data-testid="litter-young-available"
                  >
                    {t("available")}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </AppPage>
  );
}
