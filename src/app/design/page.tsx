import { notFound } from "next/navigation";
import type { FeedItem } from "@/lib/feed/types";
import { designHarnessEnabled } from "@/lib/design/harness";
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
 * (`px-3 py-4` + `flex flex-col gap-5`, FeedList.tsx), at the same column width
 * (`lg:max-w-[720px]`, AppPage.tsx). Those three values are mirrored by hand, so
 * change them here whenever they change there.
 *
 * Fixed content is also what makes screenshot baselines meaningful — real feed
 * rows change under you, so a diff would never mean anything.
 *
 * Precedent: the F0 button sampler (bbb81d2) was built for one decision and
 * removed after. This page earns its keep the same way.
 */

/**
 * Local fixtures, deliberately. The first version of this page pulled photos
 * from loremflickr, which silently served its own fallback image for some
 * requests — three tiles rendered inside bright red blocks — and would have
 * changed what it served over time, so a screenshot baseline built on it could
 * never mean anything. Committed files also keep someone else's licensed photo
 * out of a public repo.
 *
 * The three aspect ratios are the point: they prove media keeps its own shape
 * now that the forced 4:3 crop is gone.
 */
const LANDSCAPE = "/design-fixtures/landscape-4x3.svg";
const PORTRAIT = "/design-fixtures/portrait-3x4.svg";
const WIDE = "/design-fixtures/wide-16x9.svg";

const PERSON = {
  id: "fixture-person",
  username: "dailenhuntley",
  displayName: "Dailen Huntley",
  avatarUrl: PORTRAIT,
};

const BRAND = {
  id: "fixture-brand",
  name: "Ridgeline Ranch",
  slug: "ridgeline-ranch",
  avatarUrl: LANDSCAPE,
};

const CREATURE = {
  id: "fixture-creature",
  name: "Juniper",
  slug: "juniper",
  avatarUrl: LANDSCAPE,
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
    mediaUrl: LANDSCAPE,
  }),
  item({
    id: "fx-post-brand-long",
    type: "post",
    brand: BRAND,
    creature: CREATURE,
    title:
      "Long one, because people keep asking how we pick placements. We temperament test at seven weeks, not six — a week matters more than you would think at that age. Every pup gets the same five situations: a startle, a stranger, a restraint hold, a surface change, and a short separation. We write down what we see, not what we hope. Then families get matched to the dog that fits their week, not the dog they saw first on the internet.",
    mediaUrl: PORTRAIT,
  }),
  item({
    id: "fx-listing",
    type: "listing",
    brand: BRAND,
    creature: CREATURE,
    title: "Blue merle female · 8 weeks · health tested",
    mediaUrl: LANDSCAPE,
  }),
  item({
    id: "fx-reel",
    type: "reel",
    brand: BRAND,
    title: "Ten seconds of Juniper losing a fight with a leaf",
    mediaUrl: PORTRAIT,
  }),
  item({
    id: "fx-long-video",
    type: "long_video",
    brand: BRAND,
    title: "Whelping box setup, start to finish",
    mediaUrl: WIDE,
  }),
  item({
    id: "fx-promo",
    type: "promo",
    brand: BRAND,
    title: "20% off first vet check for new members",
  }),
];

export default function DesignHarnessPage() {
  if (!designHarnessEnabled(process.env)) notFound();

  return (
    <div className="lg:mx-auto lg:flex lg:max-w-5xl">
      <div className="app-surface flex min-h-dvh w-full min-w-0 flex-col lg:max-w-[720px] lg:border-x lg:border-border/60">
        <section className="px-3 py-4" data-testid="design-harness">
          <p className="eyebrow mb-3 px-1">Design harness · dev only · fixed fixtures</p>
          <div className="flex flex-col gap-5">
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
