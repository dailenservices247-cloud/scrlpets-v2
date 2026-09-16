import { notFound } from "next/navigation";
import type { FeedItem } from "@/lib/feed/types";
import { PostTile } from "@/components/feed/tiles/PostTile";
import { ReelTile } from "@/components/feed/tiles/ReelTile";
import { LongVideoTile } from "@/components/feed/tiles/LongVideoTile";
import { ListingTile } from "@/components/feed/tiles/ListingTile";
import { PromoTile } from "@/components/feed/tiles/PromoTile";

/**
 * Design harness — DEV ONLY, never routable in production.
 *
 * The feed cannot be judged against an empty database, and seeding the shared
 * dev database is not free: 62 e2e specs bind to its seeded rows. So the real
 * tiles render here against fixed fixtures, in the same wrapper the feed uses
 * (`px-3 py-4` + `flex flex-col gap-4`, FeedList.tsx), at the same column width
 * (`lg:max-w-2xl`, AppPage.tsx).
 *
 * Fixed content is also what makes screenshot baselines meaningful — real feed
 * rows change under you, so a diff would never mean anything.
 *
 * Precedent: the F0 button sampler (bbb81d2) was built for one decision and
 * removed after. This page earns its keep the same way.
 */

const PERSON = {
  id: "fixture-person",
  username: "dailenhuntley",
  displayName: "Dailen Huntley",
  avatarUrl: "https://loremflickr.com/200/200/portrait?lock=21",
};

const BRAND = {
  id: "fixture-brand",
  name: "Ridgeline Ranch",
  slug: "ridgeline-ranch",
  avatarUrl: "https://loremflickr.com/200/200/dog?lock=9",
};

const CREATURE = {
  id: "fixture-creature",
  name: "Juniper",
  slug: "juniper",
  avatarUrl: "https://loremflickr.com/200/200/puppy?lock=4",
};

function item(over: Partial<FeedItem> & Pick<FeedItem, "id" | "type">): FeedItem {
  return {
    author: PERSON,
    brand: null,
    creature: null,
    title: null,
    mediaUrl: null,
    createdAt: "2026-09-15T12:00:00.000Z",
    updatedAt: "2026-09-15T12:00:00.000Z",
    commentsEnabled: true,
    ...over,
  };
}

const ITEMS: FeedItem[] = [
  item({
    id: "fx-post-text",
    type: "post",
    title: "Vet run went fine. All six are over four pounds now.",
  }),
  item({
    id: "fx-post-media",
    type: "post",
    creature: CREATURE,
    title: "Blue merle pups, 6 weeks today. First shots done, temperament testing Saturday.",
    mediaUrl: "https://loremflickr.com/800/600/puppy?lock=11",
  }),
  item({
    id: "fx-post-brand-long",
    type: "post",
    brand: BRAND,
    creature: CREATURE,
    title:
      "Long one, because people keep asking how we pick placements. We temperament test at seven weeks, not six — a week matters more than you would think at that age. Every pup gets the same five situations: a startle, a stranger, a restraint hold, a surface change, and a short separation. We write down what we see, not what we hope. Then families get matched to the dog that fits their week, not the dog they saw first on the internet.",
    mediaUrl: "https://loremflickr.com/800/600/dog?lock=14",
  }),
  item({
    id: "fx-listing",
    type: "listing",
    brand: BRAND,
    creature: CREATURE,
    title: "Blue merle female · 8 weeks · health tested",
    mediaUrl: "https://loremflickr.com/800/600/dog?lock=17",
  }),
  item({
    id: "fx-reel",
    type: "reel",
    brand: BRAND,
    title: "Ten seconds of Juniper losing a fight with a leaf",
    mediaUrl: "https://loremflickr.com/600/900/puppy?lock=23",
  }),
  item({
    id: "fx-long-video",
    type: "long_video",
    brand: BRAND,
    title: "Whelping box setup, start to finish",
    mediaUrl: "https://loremflickr.com/800/600/dogs?lock=27",
  }),
  item({
    id: "fx-promo",
    type: "promo",
    brand: BRAND,
    title: "20% off first vet check for new members",
  }),
];

export default function DesignHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="lg:mx-auto lg:flex lg:max-w-5xl">
      <div className="app-surface flex min-h-dvh w-full min-w-0 flex-col lg:max-w-2xl lg:border-x lg:border-border/60">
        <section className="px-3 py-4" data-testid="design-harness">
          <p className="eyebrow mb-3 px-1">Design harness · dev only · fixed fixtures</p>
          <div className="flex flex-col gap-4">
            {ITEMS.map((it) => {
              if (it.type === "post")
                return <PostTile key={it.id} item={it} social={null} signedIn={false} />;
              if (it.type === "reel") return <ReelTile key={it.id} item={it} social={null} signedIn={false} />;
              if (it.type === "long_video") return <LongVideoTile key={it.id} item={it} />;
              if (it.type === "listing") return <ListingTile key={it.id} item={it} />;
              return <PromoTile key={it.id} item={it} />;
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
