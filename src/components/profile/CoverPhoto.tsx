/**
 * Person cover photo. Deliberately identical to the brand banner in
 * BrandProfileHeader (same height, same crop, same panel it sits inside) so a
 * person and a brand read as the same kind of page.
 */
export function CoverPhoto({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="h-32 w-full object-cover"
      data-testid="profile-cover"
    />
  );
}
