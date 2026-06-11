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
      className="mt-2 h-auto w-full max-h-72 rounded-md object-cover"
      data-testid="tile-media"
    />
  );
}
