import Link from "next/link";
import type { ReactNode } from "react";

/**
 * §3.3 Immersive: "Media is the tile. Identity and caption ride a gradient
 * scrim, actions on a right rail."
 *
 * Shared by the in-feed reel tile and the realm slide on purpose. The spec says
 * Immersive is "already the reel realm's language", so the feed tile is not
 * meant to resemble the realm — it is meant to BE the same register. Two copies
 * of this markup would be one register in name and two in practice, which is
 * exactly how the destination shell and the feed tile drifted apart over the
 * accent colours before `registers.ts` pulled them back together.
 *
 * `pr-16` keeps the text clear of the right rail and the mute toggle, both of
 * which sit in that gutter.
 */
export function ReelScrim({
  actorName,
  actorHref,
  avatarUrl,
  caption,
  children,
}: {
  actorName: string;
  actorHref: string;
  avatarUrl?: string | null;
  caption?: string | null;
  /** The realm passes a Follow button here; the feed tile passes nothing. */
  children?: ReactNode;
}) {
  return (
    <div
      // pointer-events-none is load-bearing, not tidiness. The scrim covers the
      // lower third of the media, and the media is the doorway: without this a
      // tap anywhere near the caption hits the gradient instead of opening the
      // realm. Playwright caught it as "reel-scrim subtree intercepts pointer
      // events"; a person would have caught it as a reel that sometimes does
      // not open. Only the identity row takes events back.
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent p-4 pb-6 pr-16"
      data-testid="reel-scrim"
    >
      <div className="pointer-events-auto flex w-fit items-center gap-2">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-9 rounded-full object-cover" />
        ) : (
          <span className="grid size-9 place-items-center rounded-full bg-primary/40 text-ui font-semibold text-white">
            {actorName.charAt(0).toUpperCase()}
          </span>
        )}
        <Link href={actorHref} className="text-ui font-semibold text-white">
          {actorName}
        </Link>
        {children}
      </div>
      {caption && <p className="mt-2 line-clamp-2 text-ui text-white/85">{caption}</p>}
    </div>
  );
}
