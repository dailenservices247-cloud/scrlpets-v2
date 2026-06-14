import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/Wordmark";
import { getFeed, type FeedTab } from "@/lib/feed/query";
import { getSessionUser } from "@/lib/auth/session";
import { FeedTabs } from "@/components/feed/FeedTabs";
import { FeedList } from "@/components/feed/FeedList";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const t = await getTranslations("app");
  const tMsg = await getTranslations("messages");
  const user = await getSessionUser(); // null = guest (feed is public per G1-A); seam stays federation-ready
  const { tab } = await searchParams;
  const feedTab: FeedTab = tab === "for_you" ? "for_you" : "following";
  const items = await getFeed(feedTab);
  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <h1>
            <Wordmark size={20} />
          </h1>
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/messages"
                className="text-sm text-brand-link underline"
                data-testid="messages-link"
              >
                {tMsg("title")}
              </Link>
              <Link
                href="/compose"
                className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
                data-testid="compose-cta"
              >
                +
              </Link>
            </div>
          ) : (
            <Link href="/login" className="text-sm underline text-brand-link" data-testid="signin-cta">
              {t("signIn")}
            </Link>
          )}
        </div>
        <FeedTabs />
      </header>
      <FeedList items={items} />
    </main>
  );
}
