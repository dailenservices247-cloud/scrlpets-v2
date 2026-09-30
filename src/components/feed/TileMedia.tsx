import { ViewTransition } from "react";
import { isVideoUrl } from "@/lib/media/media-kind";
import { FeedVideo } from "./FeedVideo";

/* Plain <img> on purpose — next/image needs remotePatterns per host; media hosts
   are dev placeholders until real storage matures. Width/height REQUIRED: at 0px
   intrinsic height Chrome's lazy-loader never fires (prod bug 2026-06-10). With
   dimensions, lazy is safe — and keeps the window load event fast (eager x15
   remote images stalled it past Playwright's timeout). */
export function TileMedia({
  src,
  alt,
  variant = "feed",
  transitionName,
}: {
  src: string | null;
  alt: string;
  variant?: "feed" | "player";
  /* The doorway rule (spec §5): pass the SAME name on the tile and on the
     destination and the browser morphs one into the other. Omit it and the
     media is an ordinary element, which is every surface that is not a
     doorway — an alumni update, a rail thumbnail. */
  transitionName?: string;
}) {
  if (!src) return null;
  const media = renderMedia({ src, alt, variant });
  if (!transitionName) return media;
  /* share="morph" names the class the 320ms curve in globals.css targets, and
     default="none" keeps every OTHER named element on the page still: without
     it, the nineteen reels that have no counterpart on the destination would
     each play an enter animation alongside the one morph that means something. */
  return (
    <ViewTransition name={transitionName} share="morph" default="none">
      {media}
    </ViewTransition>
  );
}

function renderMedia({
  src,
  alt,
  variant,
}: {
  src: string;
  alt: string;
  variant: "feed" | "player";
}) {
  // F4: video media — feed tiles autoplay muted (A3); destination pages get a
  // real player with controls (A5).
  if (isVideoUrl(src)) {
    if (variant === "player") {
      return (
         
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="mt-1 max-h-[70vh] w-full rounded-xl bg-black ring-1 ring-white/10"
          data-testid="player-video"
        />
      );
    }
    return (
      <FeedVideo
        src={src}
        className="mt-1 aspect-[4/3] w-full rounded-xl bg-black object-cover ring-1 ring-white/10"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={800}
      height={600}
      loading="lazy"
      className={
        variant === "feed"
          ? // Native aspect and full-bleed: the photo is the point of most
            // posts. Dropping aspect-[4/3] restores aspect-ratio:auto, so the
            // width/height attributes above only hold the space until the image
            // loads and the real shape takes over — no forced crop, and the
            // lazy-loader still has the intrinsic size it needs. -mx-4 pulls the
            // media to the column edge in the editorial register and to the
            // panel's inner edge in the panel register; both insets are 16px.
            // max-h caps portrait at 4:5 (spec §3.4) so one tall photo cannot
            // take the whole screen and push the next entry out of the feed.
            // The media is the column's width, so 125vw is the mobile cap and
            // 910px is the same ratio against the 728px desktop media width.
            // object-cover crops to the cap instead of letterboxing.
            "-mx-4 mt-1 h-auto max-h-[125vw] w-[calc(100%+2rem)] max-w-none object-cover lg:max-h-[910px]"
          : "mt-1 h-auto w-full rounded-xl object-cover"
      }
      data-testid="tile-media"
    />
  );
}
