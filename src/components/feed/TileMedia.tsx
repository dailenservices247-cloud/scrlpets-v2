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
}: {
  src: string | null;
  alt: string;
  variant?: "feed" | "player";
}) {
  if (!src) return null;
  // F4: video media — feed tiles autoplay muted (A3); destination pages get a
  // real player with controls (A5).
  if (isVideoUrl(src)) {
    if (variant === "player") {
      return (
        // eslint-disable-next-line jsx-a11y/media-has-caption
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
      className="mt-1 aspect-[4/3] w-full rounded-xl object-cover ring-1 ring-white/10"
      data-testid="tile-media"
    />
  );
}