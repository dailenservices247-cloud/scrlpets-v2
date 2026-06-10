/* Plain <img> on purpose for slice 1 — next/image needs remotePatterns per host;
   media hosts are dev placeholders until real storage lands (slice 2 composer). */
export function TileMedia({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="mt-2 w-full max-h-72 rounded-md object-cover"
      data-testid="tile-media"
    />
  );
}
