import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FeedList } from "@/components/feed/FeedList";
import { CreatureHero } from "@/components/profile/CreatureHero";
import { AnimalRecordsPanel } from "@/components/profile/AnimalRecordsPanel";
import { MemorialSection } from "@/components/creature/MemorialSection";
import { AboutInfoCard } from "@/components/creature/AboutInfoCard";
import { HealthTestsSection } from "@/components/creature/HealthTestsSection";
import { LineageSection } from "@/components/creature/LineageSection";
import { getCreatureBySlug, getCreatureFeed } from "@/lib/profiles/queries";
import { getAnimalRecord } from "@/lib/records/queries";
import { getSessionUser } from "@/lib/auth/session";
import {

  getCreatureDetail,
  getGeneticTests,
  getCreatureParents,
  getCreatureOffspring,
  getLitterName,
} from "@/lib/creatures/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const creature = await getCreatureBySlug(slug);
  if (!creature) return {};
  return {
    title: creature.name,
    description: `${creature.name}${creature.species ? ` the ${creature.species}` : ""} on Scrlpets — owned by @${creature.owner.username}.`,
  };
}

export default async function CreaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const creature = await getCreatureBySlug(slug);
  if (!creature) notFound();
  const [items, user, record, detail, tests, parents, offspring] = await Promise.all([
    getCreatureFeed(creature.id),
    getSessionUser(),
    getAnimalRecord(creature.id),
    getCreatureDetail(creature.id),
    getGeneticTests(creature.id),
    getCreatureParents(creature.id),
    getCreatureOffspring(creature.id),
  ]);
  const listing = items.find((item) => item.type === "listing");
  const isOwner = user?.id === creature.ownerId;
  const isDeceased = !!detail?.deceasedAt;
  const litter = detail?.litterId ? await getLitterName(detail.litterId) : null;
  const t = await getTranslations("creature");

  return (
    <main>
      <CreatureHero creature={creature} listing={listing} />

      {detail && (
        <MemorialSection
          creatureId={creature.id}
          slug={creature.slug}
          creatureName={creature.name}
          deceasedAt={detail.deceasedAt}
          memorialMessage={detail.memorialMessage}
          isOwner={isOwner}
        />
      )}

      {detail && (
        <AboutInfoCard
          creatureId={creature.id}
          slug={creature.slug}
          detail={detail}
          isOwner={isOwner}
          isDeceased={isDeceased}
        />
      )}

      {litter && (
        <section className="mx-auto max-w-2xl px-4 pt-3" data-testid="creature-litter-link">
          <Link href={`/litters/${litter.id}`} className="text-sm text-brand-link underline">
            {t("fromLitter", { name: litter.name })}
          </Link>
        </section>
      )}

      <HealthTestsSection
        creatureId={creature.id}
        slug={creature.slug}
        tests={tests}
        isOwner={isOwner}
        isDeceased={isDeceased}
      />

      <LineageSection parents={parents} offspring={offspring} isDeceased={isDeceased} />

      <AnimalRecordsPanel
        creatureId={creature.id}
        slug={creature.slug}
        record={record}
        isOwner={isOwner}
      />
      <FeedList items={items} viewerId={user?.id} />
    </main>
  );
}
