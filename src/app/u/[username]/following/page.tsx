import { notFound } from "next/navigation";
import { FollowListPage } from "@/components/profile/FollowListPage";
import { getFollowList, getProfileByUsername } from "@/lib/profiles/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `Accounts @${username} follows` };
}

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const people = await getFollowList(profile.id, "following");
  return <FollowListPage profile={profile} kind="following" people={people} />;
}
