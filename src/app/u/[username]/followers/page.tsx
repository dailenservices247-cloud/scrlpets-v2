import { notFound } from "next/navigation";
import { FollowListPage } from "@/components/profile/FollowListPage";
import { getFollowList, getProfileByUsername } from "@/lib/profiles/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `Followers of @${username}` };
}

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const people = await getFollowList(profile.id, "followers");
  return <FollowListPage profile={profile} kind="followers" people={people} />;
}
