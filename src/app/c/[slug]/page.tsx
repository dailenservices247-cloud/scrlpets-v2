import { notFound } from "next/navigation";
import { FeedList } from "@/components/feed/FeedList";
import { CreatureHero } from "@/components/profile/CreatureHero";
import { AnimalRecordsPanel } from "@/components/profile/AnimalRecordsPanel";
import { getCreatureBySlug, getCreatureFeed } from "@/lib/profiles/queries";
import { getAnimalRecord } from "@/lib/records/queries";
import { getSessionUser } from "@/lib/auth/session";

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
  const [items, user, record] = await Promise.all([
    getCreatureFeed(creature.id),
    getSessionUser(),
    getAnimalRecord(creature.id),
  ]);
  const listing = items.find((item) => item.type === "listing");

  return (
    <main>
      <CreatureHero creature={creature} listing={listing} />
      <AnimalRecordsPanel
        creatureId={creature.id}
        slug={creature.slug}
        record={record}
        isOwner={user?.id === creature.ownerId}
      />
      <FeedList items={items} viewerId={user?.id} />
    </main>
  );
}
