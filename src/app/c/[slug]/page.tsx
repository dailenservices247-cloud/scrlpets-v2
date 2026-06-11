import Link from "next/link";
import { notFound } from "next/navigation";
import { getCreatureBySlug, getCreatureFeed } from "@/lib/profiles/queries";
import { FeedList } from "@/components/feed/FeedList";

export default async function CreaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const creature = await getCreatureBySlug(slug);
  if (!creature) notFound();
  const items = await getCreatureFeed(creature.id);

  return (
    <main>
      <header
        className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 p-4 backdrop-blur"
        data-testid="creature-header"
      >
        {creature.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creature.avatarUrl} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="text-3xl" aria-hidden>
            🐾
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{creature.name}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {creature.species && <span>{creature.species} · </span>}
            <Link href={`/u/${creature.owner.username}`} className="text-brand-link underline">
              @{creature.owner.username}
            </Link>
          </p>
        </div>
      </header>
      <FeedList items={items} />
    </main>
  );
}
