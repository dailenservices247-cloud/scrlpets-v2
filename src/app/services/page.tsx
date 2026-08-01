import { permanentRedirect } from "next/navigation";

// Merged into /market. Linked from Brand OS's services manager and from the
// service-inquiry return path, so this stays a redirect, not a deletion.
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  permanentRedirect(
    `/market?tab=services${category ? `&category=${encodeURIComponent(category)}` : ""}`,
  );
}
