import { notFound, redirect } from "next/navigation";
import { ContentEditShell } from "@/components/content/ContentEditShell";
import { getSessionUser } from "@/lib/auth/session";
import { getEditableListing } from "@/lib/content/queries";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const listing = await getEditableListing(id, user.id);
  if (!listing) notFound();

  return <ContentEditShell userId={user.id} content={listing} />;
}
