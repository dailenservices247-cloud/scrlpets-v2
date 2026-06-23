import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";

type AnimalRailCreature = {
  id: string;
  name: string;
  species: string | null;
  slug: string;
  avatar_url: string | null;
};

export async function AnimalRail({ creatures }: { creatures: AnimalRailCreature[] }) {
  if (creatures.length === 0) return null;
  const t = await getTranslations("profile");

  return (
    <section className="border-b px-3 py-3" data-testid="animal-rail" aria-labelledby="animal-rail-title">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="animal-rail-title" className="text-sm font-semibold">
          {t("animalsFirst")}
        </h2>
        <span className="text-xs text-muted-foreground">{t("animalsFirstHint")}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {creatures.map((creature) => (
          <Link
            key={creature.id}
            href={`/c/${creature.slug}`}
            className="min-w-40 focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="animal-rail-card"
          >
            <Card className="h-full gap-3 p-3">
              {creature.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={creature.avatar_url}
                  alt=""
                  width={160}
                  height={112}
                  className="h-28 w-full rounded-lg object-cover"
                />
              ) : (
                <span className="grid h-28 w-full place-items-center rounded-lg bg-secondary text-2xl text-secondary-foreground" aria-hidden>
                  {creature.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold">{creature.name}</span>
                {creature.species && <span className="mt-1 block truncate text-xs text-muted-foreground">{creature.species}</span>}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
