import { permanentRedirect } from "next/navigation";

// Merged into /market. A redirect rather than a deletion: /shop is linked from
// Discover, Brand OS, the sitemap and the E2E suite, so anything missed
// degrades to a redirect instead of a 404. The category filter survives the
// move because /market?tab=supplies reads the same param.
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  permanentRedirect(
    `/market?tab=supplies${category ? `&category=${encodeURIComponent(category)}` : ""}`,
  );
}
