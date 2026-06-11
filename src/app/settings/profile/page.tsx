import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { ProfileEditForm } from "@/components/profile/ProfileEditForm";

export default async function ProfileSettingsPage() {
  const t = await getTranslations("profile");
  const user = (await getSessionUser())!; // middleware gates /settings
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username,display_name,bio")
    .eq("id", user.id)
    .single();

  return (
    <main className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">{t("edit")}</h1>
        <Link href={`/u/${data!.username}`} className="text-sm text-brand-link underline" aria-label="Back to profile">
          ←
        </Link>
      </header>
      <ProfileEditForm
        userId={user.id}
        username={data!.username}
        initial={{ displayName: data!.display_name, bio: data!.bio }}
      />
    </main>
  );
}
