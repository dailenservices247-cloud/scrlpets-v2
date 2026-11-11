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
    .select("username,display_name,bio,avatar_url,cover_url")
    .eq("id", user.id)
    .single();

  return (
    <AppPage>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {t("edit")}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Customize your public persona, bio, handle, and imagery.
            </p>
          </div>
          <Link
            href="/settings"
            className="grid size-9 place-items-center rounded-xl border border-border/70 bg-card/60 text-muted-foreground transition hover:border-border hover:bg-muted/60 hover:text-foreground"
            aria-label="Back to settings"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </header>

        <div className="space-y-6">
          <ProfileEditForm
            userId={user.id}
            username={data!.username}
            initial={{
              displayName: data!.display_name,
              bio: data!.bio,
              avatarUrl: data!.avatar_url,
              coverUrl: data!.cover_url,
            }}
          />
          <UsernameForm current={data!.username as string} />
        </div>
      </div>
    </AppPage>
  );
}
