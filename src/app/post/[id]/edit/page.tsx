import { notFound, redirect } from "next/navigation";
import { ContentEditShell } from "@/components/content/ContentEditShell";
import { getSessionUser } from "@/lib/auth/session";
import { getEditablePost } from "@/lib/content/queries";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const post = await getEditablePost(id, user.id);
  if (!post) notFound();

  return <ContentEditShell userId={user.id} content={post} />;
}
