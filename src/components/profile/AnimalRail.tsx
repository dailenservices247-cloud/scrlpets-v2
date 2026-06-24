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
    <section className="px-3 pt-4" data-testid="animal-rail" aria-labelledby="animal-rail-title">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="animal-rail-title" className="eyebrow">
          {t("animalsFirst")}
        </h2>
        <span className="max-w-36 text-right text-xs text-muted-foreground">{t("animalsFirstHint")}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {creatures.map((creature) => (
          <Link
            key={creature.id}
            href={`/c/${creature.slug}`}
            className="min-w-36 focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="animal-rail-card"
          >
            <Card className="premium-panel h-full gap-2 rounded-2xl p-2">
              {creature.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={creature.avatar_url}
                  alt=""
                  width={136}
                  height={112}
                  className="aspect-[6/5] w-full rounded-xl object-cover"
                />
              ) : (
                <span className="grid aspect-[6/5] w-full place-items-center rounded-xl bg-secondary text-2xl text-secondary-foreground" aria-hidden>
                  {creature.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 px-1 pb-1">
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
