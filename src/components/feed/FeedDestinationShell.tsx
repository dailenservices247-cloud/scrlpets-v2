import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { FeedItem, FeedItemType } from "@/lib/feed/types";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EDITORIAL_SURFACE, PANEL_ACCENT, PANEL_SURFACE, registerFor } from "@/lib/feed/registers";
import { AttributionStack } from "./AttributionStack";
import { ContentTypeBadge } from "./ContentTypeBadge";
import { FeedTileAction } from "./FeedTileAction";
import { TileMedia } from "./TileMedia";
import { realmTransitionName } from "@/lib/feed/realm-transition";
import { ContentOwnerActions } from "@/components/content/ContentOwnerActions";
import { ReportButton } from "@/components/social/ReportButton";
import { ReactionBar } from "@/components/social/ReactionBar";
import { SaveButton } from "@/components/social/SaveButton";
import { CommentThread } from "@/components/social/CommentThread";
import { getManageableBrandIds } from "@/lib/brands/queries";
import { getReactionSummary, isSaved } from "@/lib/social/reactions";
import { getComments } from "@/lib/social/comments";
import { attachPostFlags, getMoreListingsFrom } from "@/lib/feed/query";
import { loginHrefFor } from "@/lib/auth/redirect";

type DetailCopy = {
  titleKey: "postDetail" | "reelDetail" | "videoDetail" | "listingDetail" | "productDetail";
  bodyKey: "postDetailBody" | "reelDetailBody" | "videoDetailBody" | "listingDetailBody" | "productDetailBody";
};

const copyByType: Record<FeedItemType, DetailCopy> = {
  post: { titleKey: "postDetail", bodyKey: "postDetailBody" },
  reel: { titleKey: "reelDetail", bodyKey: "reelDetailBody" },
  long_video: { titleKey: "videoDetail", bodyKey: "videoDetailBody" },
  listing: { titleKey: "listingDetail", bodyKey: "listingDetailBody" },
  promo: { titleKey: "productDetail", bodyKey: "productDetailBody" },
};

/**
 * The one surface a realm sits on. A panel is a Card; an editorial entry is not
 * a box at all, so it is a plain element carrying the same testid — the e2e
 * measurement reads the register off the same node either way.
 */
function Surface({
  register,
  accent,
  children,
}: {
  register: "editorial" | "panel";
  accent: string;
  children: ReactNode;
}) {
  if (register === "editorial") {
    return (
      <div className={EDITORIAL_SURFACE} data-testid="destination-surface">
        {children}
      </div>
    );
  }
  return (
    <Card className={cn(PANEL_SURFACE, accent)} data-testid="destination-surface">
      {children}
    </Card>
  );
}

export async function FeedDestinationShell({
  item: rawItem,
  viewerId,
  children,
}: {
  item: FeedItem;
  viewerId?: string | null;
  children?: ReactNode;
}) {
  // The permalink is where a link from anywhere lands, so it loads the pin and
  // comment state itself rather than trusting the caller to have done it.
  const [item] = await attachPostFlags([rawItem]);
  const t = await getTranslations("detail");
  const tc = await getTranslations("content");
  const copy = copyByType[item.type];
  const isListing = item.type === "listing";
  const isProduct = item.type === "promo";
  // §4: the room is on the register of the tile that opened it. A post is
  // something someone said, so its realm is an entry in a column with no
  // surface under it; everything else here carries price or state.
  const register = registerFor(item.type);
  const edited =
    new Date(item.updatedAt).getTime() > new Date(item.createdAt).getTime();
  const manageableBrandIds = new Set(
    viewerId ? await getManageableBrandIds(viewerId) : [],
  );
  // matrix rows 6-7: author OR admin/owner of the attributed brand.
  const canManage =
    viewerId === item.author.id ||
    Boolean(item.brand && manageableBrandIds.has(item.brand.id));

  // Reactions + saves are posts-family only (post/reel/long_video are posts rows).
  const isPostFamily =
    item.type === "post" || item.type === "reel" || item.type === "long_video";
  const [reactions, saved, comments] = isPostFamily
    ? await Promise.all([
        getReactionSummary(item.id, viewerId),
        viewerId ? isSaved(viewerId, item.id) : Promise.resolve(false),
        getComments(item.id, viewerId),
      ])
    : [null, false, null];
  // F3 / punch list A6: a listing is a gateway into the seller's world.
  const moreListings = isListing ? await getMoreListingsFrom(item) : [];

  return (
    // A <div>, not a <main>: every route that renders this now sits inside the
    // AppPage shell, which owns the page's one <main>.
    <div className="pb-10" data-testid={`destination-${item.type}`}>
      <div className="sticky top-0 z-10 border-b bg-background/85 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-ui text-brand-link underline">
          {t("backToFeed")}
        </Link>
      </div>

      {/* 720px, not max-w-2xl's 672: §3.2 fixes the content column and AppPage
          already caps the page there, so a second narrower cap meant the morph
          landed in a column that had shrunk. Same arbitrary value AppPage uses. */}
      <section
        className="mx-auto flex w-full max-w-[720px] flex-col gap-4 p-4"
        data-testid="destination-column"
      >
        <div>
          <p className="eyebrow">{t("surfaceLabel")}</p>
          {/* A realm heading is an identity string (§9), so it takes the
              display serif — the same face a brand or an animal name uses. */}
          <h1 className="font-serif text-display" data-testid="destination-heading">
            {t(copy.titleKey)}
          </h1>
          <p className="mt-2 text-body text-muted-foreground">{t(copy.bodyKey)}</p>
        </div>

        <Surface register={register} accent={PANEL_ACCENT[item.type]}>
          <header className="flex items-start justify-between gap-3">
            <AttributionStack item={item} />
            <div className="flex flex-col items-end gap-2">
              <ContentTypeBadge type={item.type} />
              {edited && (
                <span
                  className="rounded-full border border-border/70 bg-muted/45 px-2 py-0.5 text-micro font-medium text-muted-foreground"
                  data-testid="edited-chip"
                >
                  {tc("edited")}
                </span>
              )}
            </div>
          </header>

          {(isListing || isProduct) && (
            <div
              className={`mt-4 rounded-lg border p-3 ${
                isListing ? "border-primary/30 bg-primary/10" : "border-accent/30 bg-accent/10"
              }`}
              data-testid={isListing ? "listing-detail-summary" : "product-detail-summary"}
            >
              <p className="eyebrow">
                {isListing ? t("listingSummaryLabel") : t("productSummaryLabel")}
              </p>
              <p className="mt-1 text-body text-muted-foreground">
                {isListing ? t("listingSummaryBody") : t("productSummaryBody")}
              </p>
            </div>
          )}

          <h2
            className={cn(
              "mt-4 leading-snug",
              isListing ? "font-serif text-title" : "text-title font-semibold",
            )}
          >
            {item.title ?? t("untitled")}
          </h2>
          <TileMedia
            src={item.mediaUrl}
            alt={item.title ?? ""}
            variant="player"
            transitionName={realmTransitionName(item.type, item.id)}
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-meta text-muted-foreground">{t("nextAction")}</p>
            <FeedTileAction item={item} />
          </div>
          {isPostFamily && reactions && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
              <ReactionBar
                postId={item.id}
                initialCounts={reactions.counts}
                initialMine={reactions.mine}
                signedIn={Boolean(viewerId)}
              />
              {viewerId && <SaveButton postId={item.id} initialSaved={saved} />}
            </div>
          )}
          {canManage ? (
            <div className="mt-4 border-t border-border/70 pt-4">
              <ContentOwnerActions item={item} />
            </div>
          ) : (
            viewerId &&
            item.type !== "promo" && (
              <div className="mt-4 flex justify-end border-t border-border/70 pt-4">
                <ReportButton
                  targetKind={item.type === "listing" ? "listing" : "post"}
                  targetId={item.id}
                />
              </div>
            )
          )}
        </Surface>
        {isListing && (
          <section className="mt-1" data-testid="listing-brand-gateway">
            <Link
              href={item.brand ? `/b/${item.brand.slug}` : `/u/${item.author.username}`}
              className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/70 p-3 transition hover:border-primary/45"
              data-testid="gateway-link"
            >
              {(item.brand?.avatarUrl ?? item.author.avatarUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(item.brand?.avatarUrl ?? item.author.avatarUrl)!}
                  alt=""
                  className="size-11 rounded-xl object-cover"
                />
              ) : (
                <span className="grid size-11 place-items-center rounded-xl bg-primary/20 text-base font-semibold text-brand-link">
                  {(item.brand?.name ?? item.author.displayName ?? item.author.username)
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui font-semibold">
                  {item.brand?.name ?? item.author.displayName ?? item.author.username}
                </span>
                <span className="block text-meta text-muted-foreground">
                  {t("visitSeller")}
                </span>
              </span>
            </Link>
            {moreListings.length > 0 && (
              <div className="mt-3">
                <p className="eyebrow mb-2">{t("moreFromSeller")}</p>
                <div className="flex gap-3 overflow-x-auto pb-2" data-testid="more-listings-rail">
                  {moreListings.map((listing) => (
                    <Link
                      key={listing.id}
                      href={`/listing/${listing.id}`}
                      className="w-36 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-card/70 transition hover:border-primary/45"
                    >
                      {listing.mediaUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={listing.mediaUrl} alt="" className="h-24 w-full object-cover" />
                      )}
                      <span className="block truncate p-2 text-meta font-medium">
                        {listing.title ?? t("untitled")}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
        {isPostFamily && comments && (
          <CommentThread
            postId={item.id}
            nodes={comments.nodes}
            count={comments.count}
            signedIn={Boolean(viewerId)}
            commentsEnabled={item.commentsEnabled !== false}
            loginHref={loginHrefFor(`/post/${item.id}`)}
          />
        )}
        {children}
      </section>
    </div>
  );
}
