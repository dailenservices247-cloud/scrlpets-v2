import { notFound } from "next/navigation";
import { FeedList } from "@/components/feed/FeedList";
import { CreatureHero } from "@/components/profile/CreatureHero";
import { getCreatureBySlug, getCreatureFeed } from "@/lib/profiles/queries";
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
  const [items, user] = await Promise.all([
    getCreatureFeed(creature.id),
    getSessionUser(),
  ]);
  const listing = items.find((item) => item.type === "listing");

  return (
    <main>
      <CreatureHero creature={creature} listing={listing} />
      <FeedList items={items} viewerId={user?.id} />
    </main>
  );
}
