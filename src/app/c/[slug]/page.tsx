import { notFound } from "next/navigation";
import { FeedList } from "@/components/feed/FeedList";
import { CreatureHero } from "@/components/profile/CreatureHero";
import { getCreatureBySlug, getCreatureFeed } from "@/lib/profiles/queries";

export default async function CreaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const creature = await getCreatureBySlug(slug);
  if (!creature) notFound();
  const items = await getCreatureFeed(creature.id);
  const listing = items.find((item) => item.type === "listing");

  return (
    <main>
      <CreatureHero creature={creature} listing={listing} />
      <FeedList items={items} />
    </main>
  );
}
