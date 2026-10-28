import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { AppPage } from "@/components/app/AppPage";
import { ProfileEditForm } from "@/components/profile/ProfileEditForm";
import { UsernameForm } from "@/components/profile/UsernameForm";

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
    <AppPage>
      <div className="p-4">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">{t("edit")}</h1>
          <Link
            href={`/u/${data!.username}`}
            className="grid size-8 place-items-center rounded-xl border border-border/70 bg-card/60 text-muted-foreground transition hover:border-border hover:bg-muted/60 hover:text-foreground"
            aria-label="Back to profile"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </header>
        <UsernameForm current={data!.username as string} />
        <ProfileEditForm
          userId={user.id}
          username={data!.username}
          initial={{ displayName: data!.display_name, bio: data!.bio }}
        />
      </div>
    </AppPage>
  );
}
