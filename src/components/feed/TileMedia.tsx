/* Plain <img> on purpose for slice 1 — next/image needs remotePatterns per host;
   media hosts are dev placeholders until real storage lands (slice 2 composer).
   Explicit width/height: without intrinsic dimensions the element is 0px tall and
   Chrome's loading="lazy" never fires (verified in prod 2026-06-10) — so images
   load eagerly with reserved layout space (also avoids CLS). */
export function TileMedia({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={800}
      height={600}
      className="mt-2 h-auto w-full max-h-72 rounded-md object-cover"
      data-testid="tile-media"
    />
  );
}
