import Link from "next/link";
import { getFeed, type FeedTab } from "@/lib/feed/query";
import { getSessionUser } from "@/lib/auth/session";
import { FeedTabs } from "@/components/feed/FeedTabs";
import { FeedList } from "@/components/feed/FeedList";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser(); // null = guest (feed is public per G1-A); seam stays federation-ready
  const { tab } = await searchParams;
  const feedTab: FeedTab = tab === "for_you" ? "for_you" : "following";
  const items = await getFeed(feedTab);
  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold">Scrlpets</h1>
          {!user && (
            <Link href="/login" className="text-sm underline text-brand-link" data-testid="signin-cta">
              Sign in
            </Link>
          )}
        </div>
        <FeedTabs />
      </header>
      <FeedList items={items} />
    </main>
  );
}
