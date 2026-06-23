/* Plain <img> on purpose — next/image needs remotePatterns per host; media hosts
   are dev placeholders until real storage matures. Width/height REQUIRED: at 0px
   intrinsic height Chrome's lazy-loader never fires (prod bug 2026-06-10). With
   dimensions, lazy is safe — and keeps the window load event fast (eager x15
   remote images stalled it past Playwright's timeout). */
export function TileMedia({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return null;
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
