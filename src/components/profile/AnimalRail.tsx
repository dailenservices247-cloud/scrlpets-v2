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
          <Link key={creature.id} href={`/c/${creature.slug}`} className="min-w-36 focus:outline-none focus:ring-2 focus:ring-ring">
            <Card className="flex h-full flex-col items-center gap-2 p-3 text-center">
              {creature.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={creature.avatar_url}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-2xl" aria-hidden>
                  🐾
                </span>
              )}
              <span className="max-w-28 truncate text-sm font-medium">{creature.name}</span>
              {creature.species && <span className="max-w-28 truncate text-xs text-muted-foreground">{creature.species}</span>}
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
